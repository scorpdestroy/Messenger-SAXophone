import secrets
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.config import get_settings
from app.db import Base, get_db
from app.main import app


USERNAME = "test_user"
EMAIL = "test_user@example.test"


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    # TestClient и обработчики работают в разных потоках, но видят одну БД
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    def test_db() -> Iterator[Session]:
        with Session(engine) as db:
            yield db

    try:
        Base.metadata.create_all(engine)
        monkeypatch.setitem(app.dependency_overrides, get_db, test_db)
        with TestClient(app) as test_client:
            yield test_client
    finally:
        engine.dispose()


@pytest.fixture
def password(client: TestClient) -> str:
    password = secrets.token_hex(16)
    response = client.post(
        "/auth/register",
        json={"username": USERNAME, "email": EMAIL, "password": password},
    )
    assert response.status_code == 201
    return password


def login(client: TestClient, identity: str, password: str) -> str:
    response = client.post(
        "/auth/login", json={"identity": identity, "password": password}
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.parametrize("identity", [USERNAME, EMAIL], ids=["username", "email"])
def test_login(client: TestClient, password: str, identity: str) -> None:
    token = login(client, identity, password)
    profile = client.get("/users/me", headers=bearer(token))
    assert profile.status_code == 200
    assert profile.json()["username"] == USERNAME
    assert profile.json()["email"] == EMAIL


def test_wrong_password(client: TestClient, password: str) -> None:
    response = client.post(
        "/auth/login",
        json={"identity": USERNAME, "password": password + "-wrong"},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "http_401"


def test_profile_without_token(client: TestClient) -> None:
    response = client.get("/users/me")
    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"


@pytest.mark.parametrize("problem", ["wrong_signature", "expired"])
def test_profile_rejects_invalid_jwt(
    client: TestClient, password: str, problem: str
) -> None:
    token = login(client, USERNAME, password)
    assert client.get("/users/me", headers=bearer(token)).status_code == 200

    # Меняем только подпись или срок, сохраняя ссылку на действующую сессию.
    key = get_settings().auth_secret_key
    claims = jwt.decode(token, key, algorithms=["HS256"], audience="saxophone-web")
    if problem == "expired":
        claims["iat"] = datetime.now(UTC) - timedelta(minutes=2)
        claims["exp"] = datetime.now(UTC) - timedelta(minutes=1)
    else:
        key = secrets.token_hex(32)

    invalid_token = jwt.encode(claims, key, algorithm="HS256")
    response = client.get("/users/me", headers=bearer(invalid_token))
    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"


def test_logout_revokes_only_current_session(client: TestClient, password: str) -> None:
    first = bearer(login(client, USERNAME, password))
    second = bearer(login(client, EMAIL, password))
    assert client.get("/users/me", headers=first).status_code == 200
    assert client.get("/users/me", headers=second).status_code == 200

    response = client.post("/auth/logout", headers=first)
    assert response.status_code == 204
    assert response.content == b""

    assert client.get("/users/me", headers=first).status_code == 401
    profile = client.get("/users/me", headers=second)
    assert profile.status_code == 200
    assert profile.json()["username"] == USERNAME
