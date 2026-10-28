"""Run explicitly: python -m app.seed. Never runs during server startup."""

import os

from sqlalchemy import delete

from app.db import SessionLocal
from app.models import AuthSession
from app.users import RegisterRequest, create_user, find_identity


def seed(db, password: str):
    for username, name in [("demo_alice", "Алиса"), ("demo_bob", "Боб")]:
        email = f"{username}@example.test"
        user = find_identity(db, username)
        if user:
            if user.email != email:
                raise ValueError("Demo username belongs to a different account")
            # Повторный запуск не меняет пароль уже существующего demo-аккаунта.
            continue
        create_user(
            db,
            RegisterRequest(
                username=username,
                email=email,
                password=password,
                display_name=name,
            ),
        )


if __name__ == "__main__":
    from datetime import UTC, datetime

    password = os.environ.get("DEMO_PASSWORD", "")
    if len(password) < 10 or len(password) > 128:
        raise SystemExit("Set DEMO_PASSWORD to 10–128 characters")
    with SessionLocal() as db:
        seed(db, password)
        db.execute(delete(AuthSession).where(AuthSession.expires_at <= datetime.now(UTC)))
        db.commit()
    print("Demo accounts ready: demo_alice, demo_bob")
