from functools import lru_cache
from pydantic import Field

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
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

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


@lru_cache
def get_settings():
    return Settings()