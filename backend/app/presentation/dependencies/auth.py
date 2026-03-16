import logging
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.user_service import UserService
from app.domain.entities.user import User
from app.infrastructure.database.base import get_db
from app.infrastructure.repositories.user_repository_impl import UserRepositoryImpl
from app.shared.firebase_auth import verify_firebase_id_token
from app.shared.config import settings

bearer_scheme = HTTPBearer(auto_error=False)
logger = logging.getLogger(__name__)


def get_user_service(db: AsyncSession = Depends(get_db)) -> UserService:
    user_repository = UserRepositoryImpl(db)
    return UserService(user_repository)


async def _build_unique_username(user_service: UserService, email: str, uid: str) -> str:
    local_part = email.split("@", 1)[0] if "@" in email else uid
    base = "".join(ch for ch in local_part if ch.isalnum() or ch in ("_", "-")) or "user"
    candidate = base[:24]

    if not await user_service.user_repository.exists_by_username(candidate):
        return candidate

    suffix = uid[-6:]
    return f"{candidate[:17]}-{suffix}"


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    user_service: UserService = Depends(get_user_service),
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header is missing",
        )

    token = credentials.credentials

    try:
        claims = verify_firebase_id_token(token)
    except Exception as exc:
        logger.warning("Firebase token verification failed: %s", exc)
        detail = "Could not validate Firebase credentials"
        if settings.debug:
            detail = f"{detail}: {exc}"
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
        )

    uid: Optional[str] = claims.get("uid")
    email: Optional[str] = claims.get("email")
    if not uid or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase token missing required claims",
        )

    user = await user_service.get_user_by_firebase_uid(uid)
    if user:
        return user

    user_by_email = await user_service.get_user_by_email(email)
    if user_by_email:
        updated = await user_service.update_user(user_by_email.id, firebase_uid=uid)
        return updated

    username = await _build_unique_username(user_service, email, uid)
    created_user = await user_service.create_user(
        User(
            id=None,
            email=email,
            username=username,
            firebase_uid=uid,
        )
    )
    return created_user
