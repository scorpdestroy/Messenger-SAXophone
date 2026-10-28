from datetime import UTC, datetime
from uuid import UUID, uuid4

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import AuthSession, User
from app.security import create_token, decode_token, hash_password, verify_password
from app.users import (
    RegisterRequest,
    UserPublic,
    UserSummary,
    create_user,
    find_identity,
    search_users,
)

router = APIRouter()
bearer = HTTPBearer(auto_error=False)
# Для неизвестного логина тоже проверяем хеш, чтобы не выдавать наличие аккаунта.
dummy_hash = hash_password("unused-dummy-password")


def unauthorized():
    return HTTPException(401, "Authentication required", headers={"WWW-Authenticate": "Bearer"})


def current_session(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
):
    if not credentials:
        raise unauthorized()
    try:
        payload = decode_token(credentials.credentials)
        session_id, user_id = UUID(payload["jti"]), UUID(payload["sub"])
    except (jwt.InvalidTokenError, ValueError, TypeError, KeyError):
        raise unauthorized() from None
    # Одной подписи JWT мало: после выхода запись сессии удалена из БД.
    session = db.get(AuthSession, session_id)
    if not session or session.user_id != user_id:
        raise unauthorized()
    expires = session.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)
    if expires <= datetime.now(UTC):
        raise unauthorized()
    return session


def current_user(
    session: AuthSession = Depends(current_session),
    db: Session = Depends(get_db),
):
    user = db.get(User, session.user_id)
    if user is None:
        raise unauthorized()
    return user


class LoginRequest(BaseModel):
    identity: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=128, repr=False)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserPublic


@router.post("/auth/register", tags=["auth"], response_model=UserPublic, status_code=201)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    return create_user(db, data)


@router.post("/auth/login", tags=["auth"], response_model=LoginResponse)
def login(data: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = find_identity(db, data.identity)
    valid = verify_password(data.password, user.password_hash if user else dummy_hash)
    if not user or not valid:
        raise HTTPException(
            401, "Invalid login or password", headers={"WWW-Authenticate": "Bearer"}
        )
    session_id = uuid4()
    token, expires = create_token(user.id, session_id)
    # jti в токене и id в таблице обозначают одну и ту же сессию.
    db.add(AuthSession(id=session_id, user_id=user.id, expires_at=expires))
    db.commit()
    response.headers["Cache-Control"] = "no-store"
    return LoginResponse(
        access_token=token,
        expires_in=get_settings().access_token_minutes * 60,
        user=UserPublic.model_validate(user),
    )


@router.post("/auth/logout", tags=["auth"], status_code=204)
def logout(session: AuthSession = Depends(current_session), db: Session = Depends(get_db)):
    db.execute(delete(AuthSession).where(AuthSession.id == session.id))
    db.commit()
    return Response(status_code=204)


@router.get("/users/me", tags=["users"], response_model=UserPublic)
def me(response: Response, user: User = Depends(current_user)):
    response.headers["Cache-Control"] = "no-store"
    return user


@router.get("/users", tags=["users"], response_model=list[UserSummary])
def search(
    query: str = Query(default="", max_length=80),
    limit: int = Query(default=20, ge=1, le=50),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    return search_users(db, query, user.id, limit)
