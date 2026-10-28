import re
from uuid import UUID

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import User
from app.security import hash_password


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=10, max_length=128, repr=False)
    display_name: str = Field(default="", max_length=80)

    # Пароль не обрезаем: пробел в нём может быть частью задуманного пароля.
    @field_validator("username", "email", "display_name", mode="before")
    @classmethod
    def strip_fields(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("username")
    @classmethod
    def username_valid(cls, value):
        if not re.fullmatch(r"[a-zA-Z0-9_]{3,32}", value):
            raise ValueError("Use 3–32 Latin letters, digits or underscores")
        return value.lower()

    @field_validator("email")
    @classmethod
    def email_valid(cls, value):
        if not re.fullmatch(r"[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+", value):
            raise ValueError("Invalid email")
        return value.lower()


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    username: str
    email: str
    display_name: str


class UserSummary(BaseModel):
    # В поиске показываем меньше данных, чем владельцу профиля: без почты.
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    username: str
    display_name: str


def find_identity(db: Session, identity: str):
    identity = identity.strip().lower()
    return db.scalar(
        select(User).where(
            or_(func.lower(User.username) == identity, func.lower(User.email) == identity)
        )
    )


def find_conflict(db: Session, username: str, email: str):
    return db.scalar(
        select(User.id).where(
            or_(func.lower(User.username) == username, func.lower(User.email) == email)
        )
    )


def search_users(db: Session, query: str, exclude_id, limit: int):
    query = query.strip().lower()
    if not query:
        return []
    # autoescape оставляет % и _ обычными символами поиска, а не шаблоном SQL.
    return db.scalars(
        select(User)
        .where(
            User.id != exclude_id,
            or_(
                func.lower(User.username).contains(query, autoescape=True),
                func.lower(User.display_name).contains(query, autoescape=True),
            ),
        )
        .order_by(User.username, User.id)
        .limit(limit)
    ).all()


def create_user(db: Session, data: RegisterRequest):
    if find_conflict(db, data.username, data.email):
        raise HTTPException(409, "Username or email already registered")
    user = User(
        username=data.username,
        email=data.email,
        display_name=data.display_name or data.username,
        password_hash=hash_password(data.password),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        # Два запроса могли пройти find_conflict одновременно; последнее слово за БД.
        db.rollback()
        raise HTTPException(409, "Username or email already registered") from None
    db.refresh(user)
    return user
