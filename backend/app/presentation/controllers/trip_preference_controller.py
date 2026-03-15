from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.trip_service import TripService
from app.application.services.user_service import UserService
from app.domain.entities.trip import TripPreference
from app.domain.entities.user import User
from app.infrastructure.database.base import get_db
from app.infrastructure.repositories.trip_repository_impl import TripRepositoryImpl
from app.infrastructure.repositories.user_repository_impl import UserRepositoryImpl
from app.presentation.dto.trip_dto import TripPreferenceResponse, TripPreferenceUpdate
from app.shared.auth_utils import verify_token
from app.shared.exceptions import PermissionDeniedError, TripNotFoundError

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def get_user_service(db: AsyncSession = Depends(get_db)) -> UserService:
    user_repository = UserRepositoryImpl(db)
    return UserService(user_repository)


def get_trip_service(db: AsyncSession = Depends(get_db)) -> TripService:
    trip_repository = TripRepositoryImpl(db)
    return TripService(trip_repository)


async def get_current_user_entity(
    token: str = Depends(oauth2_scheme),
    user_service: UserService = Depends(get_user_service),
) -> User:
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


@router.put("/{trip_id}/preference", response_model=TripPreferenceResponse)
async def upsert_trip_preference(
    trip_id: int,
    payload: TripPreferenceUpdate,
    current_user: User = Depends(get_current_user_entity),
    trip_service: TripService = Depends(get_trip_service),
):
    preference = TripPreference(
        id=None,
        trip_id=trip_id,
        atmosphere=payload.atmosphere,
        companions=payload.companions,
        budget=payload.budget,
        transport_type=payload.transport_type,
    )

    try:
        saved = await trip_service.upsert_my_preference(current_user.id, trip_id, preference)
        return TripPreferenceResponse.model_validate(saved)
    except TripNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
