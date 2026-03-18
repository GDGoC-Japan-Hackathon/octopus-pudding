from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.user import User
from app.infrastructure.database.base import get_db
from app.infrastructure.database.models import (
    ItineraryItemModel,
    TripDayModel,
    TripMemberModel,
    TripModel,
    TripPreferenceModel,
    UserModel,
)
from app.presentation.dependencies.auth import get_current_user
from app.presentation.dto.recommendation_dto import (
    RecommendationCloneRequest,
    RecommendationCloneResponse,
    RecommendationConfirmSaveResponse,
    RecommendationDayResponse,
    RecommendationDetailResponse,
    RecommendationListResponse,
    RecommendationTimelineItemResponse,
)

router = APIRouter()


def _build_trip_duration_label(start_date, end_date) -> str:
    total_days = (end_date - start_date).days + 1
    nights = max(total_days - 1, 0)
    return f"{nights}泊{total_days}日"


async def _get_saved_trip_map(db: AsyncSession, user_id: int) -> dict[int, int]:
    saved_result = await db.execute(
        select(TripModel.source_trip_id, TripModel.id)
        .where(
            TripModel.user_id == user_id,
            TripModel.source_trip_id.is_not(None),
            TripModel.counts_as_saved_recommendation.is_(True),
        )
        .order_by(TripModel.id.desc())
    )
    mapping: dict[int, int] = {}
    for source_trip_id, trip_id in saved_result.all():
        if source_trip_id is not None and source_trip_id not in mapping:
            mapping[source_trip_id] = trip_id
    return mapping


def _timeline_icon_from_category(category: str | None) -> str:
    if category == "food":
        return "restaurant"
    if category == "transport":
        return "train"
    return "place"


@router.post(
    "/{recommendation_id}/clone",
    response_model=RecommendationCloneResponse,
    status_code=status.HTTP_201_CREATED,
)
async def clone_recommendation(
    recommendation_id: int,
    payload: RecommendationCloneRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if payload.mode not in {"use", "customize"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid clone mode")

    result = await db.execute(
        select(TripModel)
        .where(TripModel.id == recommendation_id, TripModel.is_public.is_(True))
    )
    source_trip = result.scalar_one_or_none()
    if source_trip is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recommendation not found")

    existing_result = await db.execute(
        select(TripModel)
        .where(
            TripModel.user_id == current_user.id,
            TripModel.source_trip_id == recommendation_id,
            TripModel.counts_as_saved_recommendation.is_(payload.mode == "use"),
        )
        .order_by(TripModel.id.desc())
    )
    existing_trip = existing_result.scalar_one_or_none()
    if existing_trip is not None:
        return RecommendationCloneResponse(trip_id=existing_trip.id)

    cloned_trip = TripModel(
        user_id=current_user.id,
        origin=source_trip.origin,
        destination=source_trip.destination,
        start_date=source_trip.start_date,
        end_date=source_trip.end_date,
        participant_count=source_trip.participant_count,
        source_trip_id=recommendation_id,
        counts_as_saved_recommendation=payload.mode == "use",
        is_public=False,
        cover_image_url=source_trip.cover_image_url,
        recommendation_categories=source_trip.recommendation_categories,
        save_count=0,
        status=source_trip.status,
    )
    db.add(cloned_trip)
    await db.flush()

    if payload.mode == "use":
        source_trip.save_count = (source_trip.save_count or 0) + 1

    preference_result = await db.execute(
        select(TripPreferenceModel).where(TripPreferenceModel.trip_id == recommendation_id)
    )
    source_preference = preference_result.scalar_one_or_none()
    if source_preference is not None:
        db.add(
            TripPreferenceModel(
                trip_id=cloned_trip.id,
                atmosphere=source_preference.atmosphere,
                companions=source_preference.companions,
                budget=source_preference.budget,
                transport_type=source_preference.transport_type,
            )
        )

    db.add(
        TripMemberModel(
            trip_id=cloned_trip.id,
            user_id=current_user.id,
            role="owner",
            status="joined",
        )
    )

    day_result = await db.execute(
        select(TripDayModel)
        .where(TripDayModel.trip_id == recommendation_id)
        .order_by(TripDayModel.day_number.asc(), TripDayModel.id.asc())
    )
    source_days = day_result.scalars().all()

    for source_day in source_days:
        cloned_day = TripDayModel(
            trip_id=cloned_trip.id,
            day_number=source_day.day_number,
            date=source_day.date,
        )
        db.add(cloned_day)
        await db.flush()

        item_result = await db.execute(
            select(ItineraryItemModel)
            .where(ItineraryItemModel.trip_day_id == source_day.id)
            .order_by(
                ItineraryItemModel.sequence.asc().nulls_last(),
                ItineraryItemModel.start_time.asc().nulls_last(),
                ItineraryItemModel.id.asc(),
            )
        )
        source_items = item_result.scalars().all()
        for source_item in source_items:
            db.add(
                ItineraryItemModel(
                    trip_day_id=cloned_day.id,
                    name=source_item.name,
                    sequence=source_item.sequence,
                    category=source_item.category,
                    start_time=source_item.start_time,
                    end_time=source_item.end_time,
                    estimated_cost=source_item.estimated_cost,
                    notes=source_item.notes,
                    latitude=source_item.latitude,
                    longitude=source_item.longitude,
                )
            )

    await db.commit()
    return RecommendationCloneResponse(trip_id=cloned_trip.id)


@router.post(
    "/{recommendation_id}/confirm-save/{trip_id}",
    response_model=RecommendationConfirmSaveResponse,
    status_code=status.HTTP_200_OK,
)
async def confirm_recommendation_save(
    recommendation_id: int,
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    source_result = await db.execute(
        select(TripModel).where(TripModel.id == recommendation_id, TripModel.is_public.is_(True))
    )
    source_trip = source_result.scalar_one_or_none()
    if source_trip is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recommendation not found")

    trip_result = await db.execute(
        select(TripModel).where(
            TripModel.id == trip_id,
            TripModel.user_id == current_user.id,
            TripModel.source_trip_id == recommendation_id,
        )
    )
    saved_trip = trip_result.scalar_one_or_none()
    if saved_trip is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved trip not found")

    if not saved_trip.counts_as_saved_recommendation:
        saved_trip.counts_as_saved_recommendation = True
        source_trip.save_count = (source_trip.save_count or 0) + 1
        await db.commit()

    return RecommendationConfirmSaveResponse(trip_id=saved_trip.id)


@router.get("/", response_model=list[RecommendationListResponse])
async def list_recommendations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TripModel, UserModel)
        .join(UserModel, UserModel.id == TripModel.user_id)
        .where(TripModel.is_public.is_(True))
        .order_by(TripModel.created_at.desc(), TripModel.id.desc())
    )
    rows = result.all()
    saved_trip_map = await _get_saved_trip_map(db, current_user.id)
    return [
        RecommendationListResponse(
            id=trip.id,
            title=f"{trip.origin} → {trip.destination}",
            date_label=_build_trip_duration_label(trip.start_date, trip.end_date),
            participant_count=trip.participant_count,
            save_count=trip.save_count,
            is_saved_by_me=trip.id in saved_trip_map,
            saved_trip_id=saved_trip_map.get(trip.id),
            categories=trip.recommendation_categories or ["その他"],
            image=trip.cover_image_url or "",
        )
        for trip, user in rows
    ]


@router.get("/{recommendation_id}", response_model=RecommendationDetailResponse)
async def get_recommendation_detail(
    recommendation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TripModel, UserModel)
        .join(UserModel, UserModel.id == TripModel.user_id)
        .where(TripModel.id == recommendation_id, TripModel.is_public.is_(True))
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recommendation not found")
    trip, user = row

    day_result = await db.execute(
        select(TripDayModel)
        .where(TripDayModel.trip_id == recommendation_id)
        .order_by(TripDayModel.day_number.asc(), TripDayModel.id.asc())
    )
    days = day_result.scalars().all()

    day_ids = [day.id for day in days]
    items_by_day_id: dict[int, list[RecommendationTimelineItemResponse]] = {day_id: [] for day_id in day_ids}

    if day_ids:
        item_result = await db.execute(
            select(ItineraryItemModel)
            .where(ItineraryItemModel.trip_day_id.in_(day_ids))
            .order_by(
                ItineraryItemModel.sequence.asc().nulls_last(),
                ItineraryItemModel.start_time.asc().nulls_last(),
                ItineraryItemModel.id.asc(),
            )
        )
        items = item_result.scalars().all()
        for item in items:
            items_by_day_id[item.trip_day_id].append(
                RecommendationTimelineItemResponse(
                    id=item.id,
                    start=item.start_time.strftime("%H:%M") if item.start_time else "--:--",
                    end=item.end_time.strftime("%H:%M") if item.end_time else "--:--",
                    title=item.name,
                    body=item.notes or item.category or "詳細メモは未設定です。",
                    icon=_timeline_icon_from_category(item.category),
                )
            )

    preference_result = await db.execute(
        select(TripPreferenceModel).where(TripPreferenceModel.trip_id == recommendation_id)
    )
    preference = preference_result.scalar_one_or_none()
    saved_trip_map = await _get_saved_trip_map(db, current_user.id)

    return RecommendationDetailResponse(
        id=trip.id,
        title=f"{trip.origin} → {trip.destination}",
        image=trip.cover_image_url or "",
        username=user.username,
        date=trip.created_at.strftime("%Y年%m月%d日") if trip.created_at else "",
        area=trip.destination,
        intro=(
            f"{trip.destination}を中心に回る公開プランです。"
            if preference is None
            else f"{preference.atmosphere.value}な雰囲気で回る公開プランです。"
        ),
        budget=(
            f"¥{preference.budget:,}" if preference and preference.budget is not None else "未設定"
        ),
        move_time=(
            f"{len(days)}日間"
            if not items_by_day_id
            else f"{len(days)}日間"
        ),
        is_saved_by_me=recommendation_id in saved_trip_map,
        saved_trip_id=saved_trip_map.get(recommendation_id),
        days=[
            RecommendationDayResponse(
                key=f"day{day.day_number}",
                label=f"Day {day.day_number}",
                timeline=items_by_day_id.get(day.id, []),
            )
            for day in days
        ],
    )
