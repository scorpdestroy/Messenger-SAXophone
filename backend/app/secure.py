import base64
import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

import jwt

from app.config import get_settings


def hash_password(password: str):
    salt = secrets.token_bytes(16)
    password_bytes = password.encode("utf-8")
    key = hashlib.scrypt(
        password_bytes,
        salt=salt,
        n=2**15,
        r=8,
        p=1,
        maxmem=64 * 1024 * 1024,
    )
    # base64 переводит байты в текст для хранения в БД
    salt_text = base64.b64encode(salt).decode()
    key_text = base64.b64encode(key).decode()
    return "scrypt$" + salt_text + "$" + key_text


def verify_password(password: str, encoded: str):
    try:
        # в БД строка вида scrypt$соль$хеш
        kind, salt, expected = encoded.split("$")
        if kind != "scrypt":
            return False
        salt_bytes = base64.b64decode(salt, validate=True)
        password_bytes = password.encode("utf-8")
        # считаем хеш введённого пароля с сохранённой солью
        key = hashlib.scrypt(
            password_bytes,
            salt=salt_bytes,
            n=2**15,
            r=8,
            p=1,
            maxmem=64 * 1024 * 1024,
        )
        expected_key = base64.b64decode(expected, validate=True)
        # Библиотечное сравнение защищает от утечки по времени ответа.
        return hmac.compare_digest(key, expected_key)
    except (ValueError, TypeError):
        # Повреждённая строка хеша не должна проходить проверку.
        return False


def create_token(user_id, session_id):
    settings = get_settings()
    now = datetime.now(UTC)
    expires = now + timedelta(minutes=settings.access_token_minutes)
    # Эти данные видны владельцу токена
    payload = {
        "sub": str(user_id),       # Кому принадлежит токен
        "jti": str(session_id),    # Какая сессия создана в БД
        "iat": now,                # Когда токен выдан
        "exp": expires,            # Когда он перестанет действовать
        "iss": "saxophone-api",    # Кто выдал токен
        "aud": "saxophone-web",    # Для какого приложения
    }
    token = jwt.encode(
        payload,
        settings.auth_secret_key,
        algorithm="HS256",
    )
    return token, expires


def decode_token(token: str):
    settings = get_settings()
    # Библиотека проверяет подпись, срок и обязательные поля
    # При неверном токене она выдаёт исключение, которое обрабатывает auth.py
    return jwt.decode(
        token,
        settings.auth_secret_key,
        algorithms=["HS256"],
        issuer="saxophone-api",
        audience="saxophone-web",
        options={"require": ["sub", "jti", "iat", "exp", "iss", "aud"]},
    )
