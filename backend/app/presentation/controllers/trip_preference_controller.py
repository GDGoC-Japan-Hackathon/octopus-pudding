from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.trip_service import TripService
from app.domain.entities.trip import TripPreference
from app.domain.entities.user import User
from app.infrastructure.database.base import get_db
from app.infrastructure.repositories.trip_repository_impl import TripRepositoryImpl
from app.presentation.dependencies.auth import get_current_user
from app.presentation.dto.trip_dto import TripPreferenceResponse, TripPreferenceUpdate
from app.shared.exceptions import PermissionDeniedError, TripNotFoundError

router = APIRouter()


def get_trip_service(db: AsyncSession = Depends(get_db)) -> TripService:
    trip_repository = TripRepositoryImpl(db)
    return TripService(trip_repository)


@router.put("/{trip_id}/preference", response_model=TripPreferenceResponse)
async def upsert_trip_preference(
    trip_id: int,
    payload: TripPreferenceUpdate,
    current_user: User = Depends(get_current_user),
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
