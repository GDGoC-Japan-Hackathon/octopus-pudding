from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.trip_service import TripService
from app.domain.entities.trip import Trip, TripPreference
from app.domain.entities.user import User
from app.infrastructure.database.base import get_db
from app.infrastructure.repositories.trip_repository_impl import TripRepositoryImpl
from app.presentation.dependencies.auth import get_current_user
from app.presentation.dto.trip_dto import (
    ItineraryItemResponse,
    TripAggregateResponse,
    TripCreate,
    TripDayResponse,
    TripMemberResponse,
    TripPreferenceResponse,
    TripResponse,
    TripUpdate,
)
from app.shared.exceptions import PermissionDeniedError, TripNotFoundError

router = APIRouter()


def get_trip_service(db: AsyncSession = Depends(get_db)) -> TripService:
    trip_repository = TripRepositoryImpl(db)
    return TripService(trip_repository)


def _to_aggregate_response(aggregate) -> TripAggregateResponse:
    return TripAggregateResponse(
        trip=TripResponse.model_validate(aggregate.trip),
        preference=(
            None if aggregate.preference is None else TripPreferenceResponse.model_validate(aggregate.preference)
        ),
        members=[TripMemberResponse.model_validate(member) for member in aggregate.members],
        days=[TripDayResponse.model_validate(day) for day in aggregate.days],
        itinerary_items=[ItineraryItemResponse.model_validate(item) for item in aggregate.itinerary_items],
    )


@router.post("/", response_model=TripAggregateResponse, status_code=status.HTTP_201_CREATED)
async def create_trip(
    payload: TripCreate,
    current_user: User = Depends(get_current_user),
    trip_service: TripService = Depends(get_trip_service),
):
    trip = Trip(
        id=None,
        user_id=current_user.id,
        origin=payload.origin,
        destination=payload.destination,
        start_date=payload.start_date,
        end_date=payload.end_date,
        participant_count=payload.participant_count,
        source_trip_id=payload.source_trip_id,
        counts_as_saved_recommendation=payload.counts_as_saved_recommendation,
        is_public=payload.is_public,
        cover_image_url=payload.cover_image_url,
        recommendation_comment=payload.recommendation_comment,
        recommendation_categories=payload.recommendation_categories,
        save_count=payload.save_count,
        status=payload.status,
    )

    preference = None
    if payload.preference is not None:
        preference = TripPreference(
            id=None,
            trip_id=0,
            atmosphere=payload.preference.atmosphere,
            companions=payload.preference.companions,
            budget=payload.preference.budget,
            transport_type=payload.preference.transport_type,
            must_visit_places_text=payload.preference.must_visit_places_text,
            additional_request_comment=payload.preference.additional_request_comment,
        )

    try:
        aggregate = await trip_service.create_trip(current_user.id, trip, preference)
        return _to_aggregate_response(aggregate)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.get("/", response_model=list[TripResponse])
async def list_my_trips(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    trip_service: TripService = Depends(get_trip_service),
):
    trips = await trip_service.list_my_trips(current_user.id, skip=skip, limit=limit)
    return [TripResponse.model_validate(trip) for trip in trips]


@router.get("/{trip_id}", response_model=TripAggregateResponse)
async def get_trip_detail(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    trip_service: TripService = Depends(get_trip_service),
):
    try:
        aggregate = await trip_service.get_my_trip_detail(current_user.id, trip_id)
        return _to_aggregate_response(aggregate)
    except TripNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.patch("/{trip_id}", response_model=TripResponse)
async def update_trip(
    trip_id: int,
    payload: TripUpdate,
    current_user: User = Depends(get_current_user),
    trip_service: TripService = Depends(get_trip_service),
):
    try:
        updated_trip = await trip_service.update_my_trip(
            current_user.id,
            trip_id,
            **payload.model_dump(exclude_unset=True),
        )
        return TripResponse.model_validate(updated_trip)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except TripNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.delete("/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trip(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    trip_service: TripService = Depends(get_trip_service),
):
    try:
        await trip_service.delete_my_trip(current_user.id, trip_id)
    except TripNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
