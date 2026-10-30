import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.db import Base
from app.models import AuthSession, User
from app.secure import verify_password
from app.users.repository import find_identity
from app.users.schemas import RegisterRequest, UserPublic, UserSummary
from app.users.service import create_user


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


def data(**changes):
    return RegisterRequest(**{
        "username": " Alice ", "email": " ALICE@Example.Test ",
        "password": "valid-password", **changes,
    })


def test_registration(db):
    user = create_user(db, data())
    assert (user.username, user.email, user.display_name) == ("alice", "alice@example.test", "alice")
    assert verify_password("valid-password", user.password_hash)
    assert find_identity(db, " ALICE@EXAMPLE.TEST ").id == user.id
    assert set(UserPublic.model_validate(user).model_dump()) == {"id", "username", "email", "display_name"}
    assert set(UserSummary.model_validate(user).model_dump()) == {"id", "username", "display_name"}
    assert db.scalar(select(AuthSession)) is None


def test_invalid_and_duplicate(db):
    with pytest.raises(ValidationError):
        data(email="invalid")
    create_user(db, data())
    with pytest.raises(HTTPException) as error:
        create_user(db, data(username="other"))
    assert error.value.status_code == 409


def test_index_conflict_rolls_back(db, monkeypatch):
    from app.users import service

    create_user(db, data())
    monkeypatch.setattr(service, "find_conflict", lambda *args: None)
    with pytest.raises(HTTPException) as error:
        create_user(db, data(email="other@example.test"))
    assert error.value.status_code == 409
    assert find_identity(db, "alice") is not None
