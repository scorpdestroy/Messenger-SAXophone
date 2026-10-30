from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.secure import hash_password
from app.models import User
from app.users.repository import find_conflict
from app.users.schemas import RegisterRequest


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
        db.rollback()
        raise HTTPException(409, "Username or email already registered") from None
    db.refresh(user)
    return user
