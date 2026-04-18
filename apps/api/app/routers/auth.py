import hashlib
import hmac
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.config import settings
from app.deps import get_current_user_id
from app.schemas.auth import TokenResponse, UserLogin, UserPublic
from app.security import create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


def _password_eq_const_time(plain: str, expected: str) -> bool:
    a = hashlib.sha256(plain.encode("utf-8")).digest()
    b = hashlib.sha256(expected.encode("utf-8")).digest()
    return hmac.compare_digest(a, b)


def _is_operator_email(email: str) -> bool:
    e = email.lower().strip()
    if e == settings.operator_email.lower().strip():
        return True
    for raw in settings.operator_email_aliases.split(","):
        a = raw.strip()
        if a and e == a.lower():
            return True
    return False


@router.post("/login", response_model=TokenResponse)
async def login(body: UserLogin) -> TokenResponse:
    if _is_operator_email(body.email) and _password_eq_const_time(
        body.password, settings.operator_password
    ):
        return TokenResponse(access_token=create_access_token(settings.operator_user_id))
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect email or password",
    )


@router.get("/me", response_model=UserPublic)
async def me(user_id: Annotated[str, Depends(get_current_user_id)]) -> UserPublic:
    if user_id != settings.operator_user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserPublic(id=settings.operator_user_id, email=settings.operator_email)
