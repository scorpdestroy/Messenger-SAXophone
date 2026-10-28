import os
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.config import Settings, get_settings
from app.db import Base, get_db
from app.main import app
from app.models import AuthSession, User
from app.security import hash_password, verify_password
from app.seed import seed
from app.users import RegisterRequest, create_user, find_identity


@pytest.fixture
def db():
    postgres = os.getenv("RUN_DB_TESTS") == "1"
    engine = (
        create_engine(os.environ["DATABASE_URL"])
        if postgres
        else create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
    )
    if not postgres:
        Base.metadata.create_all(engine)
    with engine.connect() as connection:
        transaction = connection.begin()
        with Session(bind=connection, join_transaction_mode="create_savepoint") as session:
            yield session
        transaction.rollback()
    engine.dispose()


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


def payload(**changes):
    return {
        "username": "alice",
        "email": "alice@example.test",
        "password": "Valid-password-123",
        **changes,
    }


def register_login(client, **changes):
    data = payload(**changes)
    assert client.post("/auth/register", json=data).status_code == 201
    response = client.post(
        "/auth/login", json={"identity": data["username"], "password": data["password"]}
    )
    assert response.status_code == 200
    return response.json(), {"Authorization": "Bearer " + response.json()["access_token"]}


def test_register_login_profile_logout_and_revocation(client, db):
    data, headers = register_login(client, username=" Alice ", email=" ALICE@Example.Test ")
    assert data["user"]["username"] == "alice"
    assert data["user"]["email"] == "alice@example.test"
    profile = client.get("/users/me", headers=headers)
    assert profile.status_code == 200
    assert set(profile.json()) == {"id", "username", "email", "display_name"}
    assert "password" not in str(data)
    user = db.scalar(select(User))
    assert user.password_hash != payload()["password"]
    assert verify_password(payload()["password"], user.password_hash)
    assert client.post("/auth/logout", headers=headers).status_code == 204
    assert client.get("/users/me", headers=headers).status_code == 401
    assert client.post("/auth/logout", headers=headers).status_code == 401


@pytest.mark.parametrize(
    "changes",
    [
        {"email": "not-an-email"},
        {"username": "a"},
        {"username": "bad user"},
        {"password": "short"},
        {"password": "a" * 129},
        {"email": "a@b"},
        {"username": None},
        {"display_name": "x" * 81},
    ],
)
def test_invalid_registration_is_400_without_password_leak(client, changes):
    response = client.post("/auth/register", json=payload(**changes))
    assert response.status_code == 400
    assert "password" not in response.text


@pytest.mark.parametrize(
    "changes",
    [
        {"username": "ALICE", "email": "other@example.test"},
        {"username": "other", "email": "ALICE@example.test"},
    ],
)
def test_duplicate_identity(client, changes):
    assert client.post("/auth/register", json=payload()).status_code == 201
    assert client.post("/auth/register", json=payload(**changes)).status_code == 409


def test_login_failure_is_generic(client):
    register_login(client)
    a = client.post("/auth/login", json={"identity": "alice", "password": "wrong"})
    b = client.post("/auth/login", json={"identity": "missing", "password": "wrong"})
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json()
    assert (
        client.post(
            "/auth/login",
            json={"identity": "ALICE@EXAMPLE.TEST", "password": payload()["password"]},
        ).status_code
        == 200
    )


@pytest.mark.parametrize("token", [None, "invalid", "a.b.c"])
def test_protected_routes_reject_bad_tokens(client, token):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    for path in ["/users/me", "/users?query=alice"]:
        response = client.get(path, headers=headers)
        assert response.status_code == 401
        assert response.headers["WWW-Authenticate"] == "Bearer"


@pytest.mark.parametrize(
    "change",
    ["expired", "signature", "audience", "issuer", "missing-exp", "no-session", "wrong-user"],
)
def test_jwt_validation(client, db, change):
    data, _ = register_login(client)
    claims = jwt.decode(data["access_token"], options={"verify_signature": False})
    secret = get_settings().auth_secret_key
    if change == "expired":
        claims["exp"] = datetime.now(UTC) - timedelta(seconds=1)
    if change == "signature":
        secret = "a-different-signing-key-with-32-bytes"
    if change == "audience":
        claims["aud"] = "other"
    if change == "issuer":
        claims["iss"] = "other"
    if change == "missing-exp":
        del claims["exp"]
    if change == "no-session":
        claims["jti"] = str(uuid4())
    if change == "wrong-user":
        claims["sub"] = str(uuid4())
    token = jwt.encode(claims, secret, algorithm="HS256")
    assert client.get("/users/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_database_expiry_and_independent_sessions(client, db):
    _, headers = register_login(client)
    other = client.post(
        "/auth/login", json={"identity": "alice", "password": payload()["password"]}
    ).json()
    session = db.scalar(select(AuthSession).order_by(AuthSession.expires_at))
    session.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    db.commit()
    assert client.get("/users/me", headers=headers).status_code == 401
    other_headers = {"Authorization": "Bearer " + other["access_token"]}
    assert client.get("/users/me", headers=other_headers).status_code == 200
    assert client.post("/auth/logout", headers=other_headers).status_code == 204


def test_user_search_is_bounded_literal_and_private(client):
    _, headers = register_login(client)
    for username in ["bob", "bob_two", "carol"]:
        assert (
            client.post(
                "/auth/register", json=payload(username=username, email=f"{username}@example.test")
            ).status_code
            == 201
        )
    response = client.get("/users?query=BOB&limit=1", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert set(response.json()[0]) == {"id", "username", "display_name"}
    for query in ["%", "' OR 1=1 --", "alice", ""]:
        assert client.get("/users", params={"query": query}, headers=headers).json() == []
    assert len(client.get("/users?query=_", headers=headers).json()) == 1
    assert client.get("/users?limit=51", headers=headers).status_code == 400


def test_user_service_conflict_and_seed_repeat(db):
    user = create_user(db, RegisterRequest(**payload()))
    assert find_identity(db, "ALICE").id == user.id
    with pytest.raises(HTTPException) as error:
        create_user(db, RegisterRequest(**payload()))
    assert error.value.status_code == 409
    seed(db, "Demo-only-password-123")
    seed(db, "Demo-only-password-123")
    assert db.scalar(select(func.count()).select_from(User)) == 3
    assert verify_password("Demo-only-password-123", find_identity(db, "demo_alice").password_hash)


def test_hash_salt_and_production_configuration():
    a, b = hash_password("same-password"), hash_password("same-password")
    assert a != b
    assert verify_password("same-password", a)
    assert not verify_password("wrong", a)
    assert not verify_password("same-password", "invalid")
    with pytest.raises(ValueError):
        Settings(app_env="production", auth_secret_key="")
    with pytest.raises(ValueError):
        Settings(auth_secret_key="short")
    assert Settings(app_env="production", auth_secret_key="a" * 48).auth_secret_key


def test_unique_constraint_handles_registration_race(db, monkeypatch):
    from app import users as service

    create_user(db, RegisterRequest(**payload()))
    monkeypatch.setattr(service, "find_conflict", lambda *args: None)
    with pytest.raises(HTTPException) as error:
        create_user(db, RegisterRequest(**payload()))
    assert error.value.status_code == 409
    assert find_identity(db, "alice") is not None


def test_database_rejects_case_variant_even_without_service(db):
    from sqlalchemy.exc import IntegrityError

    create_user(db, RegisterRequest(**payload()))
    db.add(
        User(
            username="ALICE",
            email="another@example.test",
            display_name="Another",
            password_hash="not-a-password",
        )
    )
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
