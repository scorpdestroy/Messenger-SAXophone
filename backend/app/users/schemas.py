import re
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=10, max_length=128, repr=False)
    display_name: str = Field(default="", max_length=80)

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
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    username: str
    display_name: str
