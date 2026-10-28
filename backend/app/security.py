import base64
import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

import jwt

from app.config import get_settings


def hash_password(password: str):
    # Случайная соль даёт разные хеши даже для одинаковых паролей.
    salt = secrets.token_bytes(16)
    key = hashlib.scrypt(password.encode(), salt=salt, n=2**15, r=8, p=1, maxmem=64 * 1024 * 1024)
    return "scrypt$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(key).decode()


def verify_password(password: str, encoded: str):
    try:
        kind, salt, expected = encoded.split("$")
        if kind != "scrypt":
            return False
        key = hashlib.scrypt(
            password.encode(),
            salt=base64.b64decode(salt, validate=True),
            n=2**15,
            r=8,
            p=1,
            maxmem=64 * 1024 * 1024,
        )
        return hmac.compare_digest(key, base64.b64decode(expected, validate=True))
    except (ValueError, TypeError):
        return False


def create_token(user_id, session_id):
    settings = get_settings()
    now = datetime.now(UTC)
    expires = now + timedelta(minutes=settings.access_token_minutes)
    token = jwt.encode(
        {
            "sub": str(user_id),
            "jti": str(session_id),
            "iat": now,
            "exp": expires,
            "iss": "saxophone-api",
            "aud": "saxophone-web",
        },
        settings.auth_secret_key,
        algorithm="HS256",
    )
    return token, expires


def decode_token(token: str):
    # Токен подписан, но не зашифрован. Пароль в него не кладём.
    return jwt.decode(
        token,
        get_settings().auth_secret_key,
        algorithms=["HS256"],
        issuer="saxophone-api",
        audience="saxophone-web",
        options={"require": ["sub", "jti", "iat", "exp", "iss", "aud"]},
    )
