from typing import Any

from pydantic import BaseModel, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    # Plain str: EmailStr rejects reserved/special TLDs like .local (operator@cipherstrike.local).
    email: str = Field(min_length=1, max_length=256)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email", mode="before")
    @classmethod
    def email_strip(cls, v: Any) -> str:
        if v is None or (isinstance(v, str) and not v.strip()):
            raise ValueError("Email is required")
        t = v.strip() if isinstance(v, str) else str(v)
        if t.count("@") != 1:
            raise ValueError("Invalid email format")
        local, domain = t.split("@", 1)
        if not local or not domain:
            raise ValueError("Invalid email format")
        return t


class UserPublic(BaseModel):
    id: str
    email: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
