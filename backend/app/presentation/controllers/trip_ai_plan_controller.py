from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.trip_service import TripService
from app.domain.entities.user import User
from app.infrastructure.database.base import get_db
from app.infrastructure.repositories.trip_repository_impl import TripRepositoryImpl
from app.presentation.dependencies.auth import get_current_user
from app.presentation.dto.trip_dto import AiPlanGenerationCreate, AiPlanGenerationResponse
from app.shared.exceptions import (
    AiPlanGenerationNotFoundError,
    ItineraryItemNotFoundError,
    PermissionDeniedError,
    TripDayNotFoundError,
    TripNotFoundError,
)

router = APIRouter()


def get_trip_service(db: AsyncSession = Depends(get_db)) -> TripService:
    trip_repository = TripRepositoryImpl(db)
    return TripService(trip_repository)


@router.post(
    "/{trip_id}/ai-plan-generations",
    response_model=AiPlanGenerationResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_ai_plan_generation(
    trip_id: int,
    payload: AiPlanGenerationCreate,
    current_user: User = Depends(get_current_user),
    trip_service: TripService = Depends(get_trip_service),
):
    try:
        generation = await trip_service.start_my_ai_plan_generation(
            owner_user_id=current_user.id,
            trip_id=trip_id,
            origin={"latitude": payload.origin.latitude, "longitude": payload.origin.longitude},
            destination={"latitude": payload.destination.latitude, "longitude": payload.destination.longitude},
            lodging=(
                None
                if payload.lodging is None
                else {"latitude": payload.lodging.latitude, "longitude": payload.lodging.longitude}
            ),
            provider=payload.provider,
            prompt_version=payload.prompt_version,
            run_async=payload.run_async,
            regeneration_mode=payload.regeneration_mode,
            target_day_id=payload.target_day_id,
            target_item_id=payload.target_item_id,
            must_visit_places=payload.must_visit_places,
            lodging_notes=payload.lodging_notes,
            additional_request_comment=payload.additional_request_comment,
            selected_companion_names=payload.selected_companion_names,
        )
        return AiPlanGenerationResponse.model_validate(generation)
    except TripNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except TripDayNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ItineraryItemNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


@router.get(
    "/{trip_id}/ai-plan-generations/{generation_id}",
    response_model=AiPlanGenerationResponse,
)
async def get_ai_plan_generation(
    trip_id: int,
    generation_id: int,
    current_user: User = Depends(get_current_user),
    trip_service: TripService = Depends(get_trip_service),
):
    try:
        generation = await trip_service.get_my_ai_plan_generation(
            owner_user_id=current_user.id,
            trip_id=trip_id,
            generation_id=generation_id,
        )
        return AiPlanGenerationResponse.model_validate(generation)
    except TripNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except AiPlanGenerationNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
