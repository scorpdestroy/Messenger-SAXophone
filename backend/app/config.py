from functools import lru_cache
import secrets
from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    auth_secret_key: str = Field(min_length=32, repr=False)
    access_token_minutes: int = Field(default=60, ge=1, le=1440)
    database_url: str = (
        "postgresql+psycopg://messenger:local-messenger"
        "@localhost:55432/messenger"
    )
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:8080",
    ]

    @model_validator(mode="after")
    def validate_auth(self):
        if not self.auth_secret_key and self.app_env in {"development", "test"}:
            self.auth_secret_key = secrets.token_urlsafe(48)
        if len(self.auth_secret_key.encode()) < 32:
            raise ValueError("AUTH_SECRET_KEY must contain at least 32 bytes")
        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


@lru_cache
def get_settings():
    return Settings()
