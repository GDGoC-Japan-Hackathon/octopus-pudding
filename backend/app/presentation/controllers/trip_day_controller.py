from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.trip_service import TripService
from app.domain.entities.trip import ItineraryItem
from app.domain.entities.user import User
from app.infrastructure.database.base import get_db
from app.infrastructure.repositories.trip_repository_impl import TripRepositoryImpl
from app.presentation.dependencies.auth import get_current_user
from app.presentation.dto.trip_dto import (
    ItineraryItemCreate,
    ItineraryItemResponse,
    ItineraryItemUpdate,
    TripDayCreate,
    TripDayResponse,
    TripDayUpdate,
)
from app.shared.exceptions import (
    ItineraryItemNotFoundError,
    PermissionDeniedError,
    TripDayNotFoundError,
    TripNotFoundError,
)

router = APIRouter()


def get_trip_service(db: AsyncSession = Depends(get_db)) -> TripService:
    trip_repository = TripRepositoryImpl(db)
    return TripService(trip_repository)


@router.post("/{trip_id}/days", response_model=TripDayResponse, status_code=status.HTTP_201_CREATED)
async def create_trip_day(
    trip_id: int,
    payload: TripDayCreate,
    current_user: User = Depends(get_current_user),
    trip_service: TripService = Depends(get_trip_service),
):
    try:
        day = await trip_service.add_my_day(
            owner_user_id=current_user.id,
            trip_id=trip_id,
            day_number=payload.day_number,
            day_date=payload.date,
            lodging_note=payload.lodging_note,
        )
        return TripDayResponse.model_validate(day)
    except TripNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.patch("/{trip_id}/days/{day_id}", response_model=TripDayResponse)
async def update_trip_day(
    trip_id: int,
    day_id: int,
    payload: TripDayUpdate,
    current_user: User = Depends(get_current_user),
    trip_service: TripService = Depends(get_trip_service),
):
    try:
        day = await trip_service.update_my_day(
            owner_user_id=current_user.id,
            trip_id=trip_id,
            day_id=day_id,
            day_number=payload.day_number,
            day_date=payload.date,
            lodging_note=payload.lodging_note,
            apply_day_date="date" in payload.model_fields_set,
            apply_lodging_note="lodging_note" in payload.model_fields_set,
        )
        return TripDayResponse.model_validate(day)
    except TripNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except TripDayNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.delete("/{trip_id}/days/{day_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trip_day(
    trip_id: int,
    day_id: int,
    current_user: User = Depends(get_current_user),
    trip_service: TripService = Depends(get_trip_service),
):
    try:
        await trip_service.delete_my_day(
            owner_user_id=current_user.id,
            trip_id=trip_id,
            day_id=day_id,
        )
    except TripNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except TripDayNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.post(
    "/{trip_id}/days/{day_id}/items",
    response_model=ItineraryItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_itinerary_item(
    trip_id: int,
    day_id: int,
    payload: ItineraryItemCreate,
    current_user: User = Depends(get_current_user),
    trip_service: TripService = Depends(get_trip_service),
):
    item = ItineraryItem(
        id=None,
        trip_day_id=day_id,
        name=payload.name,
        category=payload.category,
        latitude=payload.latitude,
        longitude=payload.longitude,
        start_time=payload.start_time,
        end_time=payload.end_time,
        estimated_cost=payload.estimated_cost,
        notes=payload.notes,
    )
    try:
        created = await trip_service.add_my_item(
            owner_user_id=current_user.id,
            trip_id=trip_id,
            day_id=day_id,
            item=item,
        )
        return ItineraryItemResponse.model_validate(created)
    except TripNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except TripDayNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.patch("/{trip_id}/days/{day_id}/items/{item_id}", response_model=ItineraryItemResponse)
async def update_itinerary_item(
    trip_id: int,
    day_id: int,
    item_id: int,
    payload: ItineraryItemUpdate,
    current_user: User = Depends(get_current_user),
    trip_service: TripService = Depends(get_trip_service),
):
    try:
        item = await trip_service.update_my_item(
            owner_user_id=current_user.id,
            trip_id=trip_id,
            day_id=day_id,
            item_id=item_id,
            **payload.model_dump(exclude_unset=True),
        )
        return ItineraryItemResponse.model_validate(item)
    except TripNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except TripDayNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ItineraryItemNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.delete("/{trip_id}/days/{day_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_itinerary_item(
    trip_id: int,
    day_id: int,
    item_id: int,
    current_user: User = Depends(get_current_user),
    trip_service: TripService = Depends(get_trip_service),
):
    try:
        await trip_service.delete_my_item(
            owner_user_id=current_user.id,
            trip_id=trip_id,
            day_id=day_id,
            item_id=item_id,
        )
    except TripNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except TripDayNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ItineraryItemNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
