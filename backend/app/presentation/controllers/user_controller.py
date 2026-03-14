from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.application.services.user_service import UserService
from app.domain.entities.user import User
from app.infrastructure.database.base import get_db
from app.infrastructure.repositories.user_repository_impl import UserRepositoryImpl
from app.presentation.dto.user_dto import UserUpdate, UserResponse
from app.shared.auth_utils import verify_token
from app.shared.exceptions import UserNotFoundError

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def get_user_service(db: AsyncSession = Depends(get_db)) -> UserService:
    """Dependency to get user service"""
    user_repository = UserRepositoryImpl(db)
    return UserService(user_repository)


async def get_current_user_entity(
    token: str = Depends(oauth2_scheme),
    user_service: UserService = Depends(get_user_service),
) -> User:
    """Resolve current user from bearer token."""
    email = verify_token(token)
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    user = await user_service.get_user_by_email(email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


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
async def get_me(current_user: User = Depends(get_current_user_entity)):
    """Get current authenticated user."""
    return UserResponse.model_validate(current_user)


@router.patch("/me", response_model=UserResponse)
async def update_me(
    user: UserUpdate,
    current_user: User = Depends(get_current_user_entity),
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
