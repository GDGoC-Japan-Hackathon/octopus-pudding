from fastapi import APIRouter, Depends

from app.domain.entities.user import User
from app.presentation.dependencies.auth import get_current_user
from app.presentation.dto.auth_dto import AuthMeResponse

router = APIRouter()


@router.get("/me", response_model=AuthMeResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user via Firebase bearer token."""
    return AuthMeResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        is_active=current_user.is_active,
        firebase_uid=current_user.firebase_uid,
        profile_image_url=current_user.profile_image_url,
        nearest_station=current_user.nearest_station,
    )
