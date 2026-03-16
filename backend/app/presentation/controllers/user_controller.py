import logging
from urllib.parse import urlparse
from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from google.api_core.exceptions import NotFound
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.application.services.user_service import UserService
from app.domain.entities.user import User
from app.infrastructure.database.base import get_db
from app.infrastructure.external import CloudStorageClient
from app.infrastructure.repositories.user_repository_impl import UserRepositoryImpl
from app.presentation.dependencies.auth import get_current_user
from app.presentation.dto.user_dto import (
    UserUpdate,
    UserResponse,
)
from app.shared.config import settings
from app.shared.exceptions import UserNotFoundError

router = APIRouter()
logger = logging.getLogger(__name__)


def get_user_service(db: AsyncSession = Depends(get_db)) -> UserService:
    """Dependency to get user service"""
    user_repository = UserRepositoryImpl(db)
    return UserService(user_repository)


def _upload_profile_image_blocking(
    file_obj,
    user_id: int,
    original_filename: str,
    content_type: str,
):
    """Run blocking GCS upload in worker thread."""
    storage_client = CloudStorageClient()
    return storage_client.upload_profile_image(
        file=file_obj,
        user_id=user_id,
        original_filename=original_filename,
        content_type=content_type,
    )


def _download_profile_image_blocking(object_path: str) -> tuple[bytes, str]:
    storage_client = CloudStorageClient()
    return storage_client.download_object(object_path)


def _resolve_object_path(raw_value: str, bucket_name: str) -> str:
    value = raw_value.strip()
    if not value:
        raise ValueError("profile image path is empty")

    if value.startswith("http://") or value.startswith("https://"):
        parsed = urlparse(value)
        # https://storage.googleapis.com/<bucket>/<object_path>
        path = parsed.path.lstrip("/")
        bucket_prefix = f"{bucket_name}/"
        if path.startswith(bucket_prefix):
            return path[len(bucket_prefix):]
        # Compatibility fallback if bucket differs but URL still contains object path only.
        parts = path.split("/", 1)
        if len(parts) == 2:
            return parts[1]
        raise ValueError("could not resolve object path from public URL")

    if value.startswith("gs://"):
        # gs://bucket/object_path
        path = value[5:]
        parts = path.split("/", 1)
        if len(parts) != 2:
            raise ValueError("invalid gs:// path")
        return parts[1]

    # already object path
    return value


@router.get("/", response_model=List[UserResponse])
async def get_users(
    skip: int = 0, 
    limit: int = 100, 
    user_service: UserService = Depends(get_user_service)
):
    """Get all users"""
    users = await user_service.get_all_users(skip=skip, limit=limit)
    return [UserResponse.model_validate(user) for user in users]


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user."""
    return UserResponse.model_validate(current_user)


@router.patch("/me", response_model=UserResponse)
async def update_me(
    user: UserUpdate,
    current_user: User = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service),
):
    """Update current authenticated user."""
    try:
        updated_user = await user_service.update_user(
            current_user.id,
            **user.model_dump(exclude_unset=True),
        )
        return UserResponse.model_validate(updated_user)
    except UserNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.post("/me/profile-image", response_model=UserResponse)
async def upload_me_profile_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service),
):
    """Upload profile image to Cloud Storage and persist object_path to users.profile_image_url."""
    logger.info(
        "profile-image upload requested: user_id=%s filename=%s content_type=%s",
        current_user.id,
        file.filename,
        file.content_type,
    )

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only image files are allowed",
        )

    try:
        uploaded = await run_in_threadpool(
            _upload_profile_image_blocking,
            file.file,
            user_id=current_user.id,
            original_filename=file.filename or "profile-image",
            content_type=file.content_type,
        )
        updated_user = await user_service.update_user(
            current_user.id,
            profile_image_url=uploaded.object_path,
        )
        logger.info(
            "profile-image upload succeeded: user_id=%s object_path=%s",
            current_user.id,
            uploaded.object_path,
        )
        return UserResponse.model_validate(updated_user)
    except UserNotFoundError as e:
        logger.warning("profile-image upload failed: user not found user_id=%s err=%s", current_user.id, e)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except ValueError as e:
        logger.exception("profile-image upload value error: user_id=%s", current_user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
    except Exception:
        logger.exception("profile-image upload unexpected error: user_id=%s", current_user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Profile image upload failed",
        )
    finally:
        await file.close()


@router.get("/me/profile-image")
async def get_me_profile_image(
    current_user: User = Depends(get_current_user),
):
    """Return current user's profile image binary from private GCS object."""
    if not current_user.profile_image_url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile image is not set",
        )

    if not settings.gcs_bucket_name:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GCS bucket is not configured",
        )

    try:
        object_path = _resolve_object_path(
            raw_value=current_user.profile_image_url,
            bucket_name=settings.gcs_bucket_name,
        )
        content, content_type = await run_in_threadpool(
            _download_profile_image_blocking,
            object_path,
        )
        return Response(content=content, media_type=content_type)
    except ValueError as exc:
        logger.exception(
            "failed to resolve object path for profile image download: user_id=%s",
            current_user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except NotFound:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile image is not found",
        )
    except Exception:
        logger.exception(
            "failed to stream profile image: user_id=%s",
            current_user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch profile image",
        )


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int, 
    user_service: UserService = Depends(get_user_service)
):
    """Get user by ID"""
    try:
        user = await user_service.get_user_by_id(user_id)
        return UserResponse.model_validate(user)
    except UserNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int, 
    user: UserUpdate, 
    user_service: UserService = Depends(get_user_service)
):
    """Update user"""
    try:
        updated_user = await user_service.update_user(user_id, **user.model_dump(exclude_unset=True))
        return UserResponse.model_validate(updated_user)
    except UserNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    user_service: UserService = Depends(get_user_service)
):
    """Delete user"""
    try:
        await user_service.delete_user(user_id)
    except UserNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
