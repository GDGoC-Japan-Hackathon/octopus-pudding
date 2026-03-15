from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import timedelta

from app.infrastructure.database.base import get_db
from app.infrastructure.repositories.user_repository_impl import UserRepositoryImpl
from app.application.services.user_service import UserService
from app.presentation.dependencies.auth import get_current_user as get_authenticated_user
from app.shared.auth_utils import (
    verify_password, 
    get_password_hash, 
    create_access_token
)
from app.shared.config import settings
from app.presentation.dto.auth_dto import (
    LoginRequest, 
    LoginResponse, 
    RegisterRequest, 
    RegisterResponse
)
from app.domain.entities.user import User

router = APIRouter()

def get_user_service(db: AsyncSession = Depends(get_db)) -> UserService:
    """Get user service instance"""
    user_repository = UserRepositoryImpl(db)
    return UserService(user_repository)

@router.post("/login", response_model=LoginResponse)
async def login(
    login_data: LoginRequest,
    user_service: UserService = Depends(get_user_service)
):
    """Login endpoint"""
    try:
        # Get user by email
        user = await user_service.get_user_by_email(login_data.email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )
        
        # Verify password
        if not verify_password(login_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )
        
        # Create access token
        access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
        access_token = create_access_token(
            data={"sub": user.email}, 
            expires_delta=access_token_expires
        )
        
        return LoginResponse(
            access_token=access_token,
            user_id=user.id,
            email=user.email
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.post("/register", response_model=RegisterResponse)
async def register(
    register_data: RegisterRequest,
    user_service: UserService = Depends(get_user_service)
):
    """Register endpoint"""
    try:
        # Check if user already exists
        existing_user = await user_service.get_user_by_email(register_data.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Create new user
        hashed_password = get_password_hash(register_data.password)
        
        new_user = User(
            id=None,
            email=register_data.email,
            username=register_data.username,
            hashed_password=hashed_password
        )
        
        created_user = await user_service.create_user(new_user)
        
        return RegisterResponse(
            message="User registered successfully",
            user_id=created_user.id,
            email=created_user.email
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.get("/me")
async def get_current_user(
    current_user: User = Depends(get_authenticated_user),
):
    """Get current authenticated user via Firebase bearer token."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username,
        "is_active": current_user.is_active,
        "firebase_uid": current_user.firebase_uid,
    } 
