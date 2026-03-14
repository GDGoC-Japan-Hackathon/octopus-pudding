from typing import Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.trip import (
    ItineraryItem,
    Trip,
    TripAggregate,
    TripAtmosphere,
    TripDay,
    TripMember,
    TripPreference,
)
from app.domain.repositories.trip_repository import TripRepository
from app.infrastructure.database.models import (
    ItineraryItemModel,
    TripDayModel,
    TripMemberModel,
    TripModel,
    TripPreferenceModel,
)


class TripRepositoryImpl(TripRepository):
    """Trip repository implementation built around aggregate reads/writes."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_trip(self, trip: Trip, preference: Optional[TripPreference] = None) -> TripAggregate:
        db_trip = TripModel(
            user_id=trip.user_id,
            origin=trip.origin,
            destination=trip.destination,
            start_date=trip.start_date,
            end_date=trip.end_date,
            status=trip.status,
        )
        self.db.add(db_trip)
        await self.db.flush()

        db_preference = None
        if preference:
            db_preference = TripPreferenceModel(
                trip_id=db_trip.id,
                atmosphere=TripPreferenceModel.TripAtmosphere(preference.atmosphere.value),
                companions=preference.companions,
                budget=preference.budget,
                transport_type=preference.transport_type,
            )
            self.db.add(db_preference)

        await self.db.commit()
        await self.db.refresh(db_trip)
        if db_preference:
            await self.db.refresh(db_preference)

        return TripAggregate(
            trip=self._to_trip_entity(db_trip),
            preference=self._to_preference_entity(db_preference) if db_preference else None,
        )

    async def get_trip_aggregate(self, trip_id: int) -> Optional[TripAggregate]:
        trip_result = await self.db.execute(select(TripModel).where(TripModel.id == trip_id))
        db_trip = trip_result.scalar_one_or_none()
        if not db_trip:
            return None

        preference_result = await self.db.execute(
            select(TripPreferenceModel).where(TripPreferenceModel.trip_id == trip_id)
        )
        db_preference = preference_result.scalar_one_or_none()

        members_result = await self.db.execute(
            select(TripMemberModel).where(TripMemberModel.trip_id == trip_id)
        )
        db_members = members_result.scalars().all()

        days_result = await self.db.execute(
            select(TripDayModel)
            .where(TripDayModel.trip_id == trip_id)
            .order_by(TripDayModel.day_number.asc())
        )
        db_days = days_result.scalars().all()
        day_ids = [day.id for day in db_days]
        db_items = []
        if day_ids:
            items_result = await self.db.execute(
                select(ItineraryItemModel).where(ItineraryItemModel.trip_day_id.in_(day_ids))
            )
            db_items = items_result.scalars().all()

        return TripAggregate(
            trip=self._to_trip_entity(db_trip),
            preference=self._to_preference_entity(db_preference) if db_preference else None,
            members=[self._to_member_entity(member) for member in db_members],
            days=[self._to_day_entity(day) for day in db_days],
            itinerary_items=[self._to_item_entity(item) for item in db_items],
        )

    async def list_by_user(self, user_id: int, skip: int = 0, limit: int = 100) -> list[Trip]:
        result = await self.db.execute(
            select(TripModel)
            .where(TripModel.user_id == user_id)
            .order_by(TripModel.start_date.asc())
            .offset(skip)
            .limit(limit)
        )
        db_trips = result.scalars().all()
        return [self._to_trip_entity(db_trip) for db_trip in db_trips]

    async def update_trip(self, trip: Trip) -> Optional[Trip]:
        result = await self.db.execute(select(TripModel).where(TripModel.id == trip.id))
        db_trip = result.scalar_one_or_none()
        if db_trip is None:
            return None

        db_trip.origin = trip.origin
        db_trip.destination = trip.destination
        db_trip.start_date = trip.start_date
        db_trip.end_date = trip.end_date
        db_trip.status = trip.status

        await self.db.commit()
        await self.db.refresh(db_trip)
        return self._to_trip_entity(db_trip)

    async def delete_trip(self, trip_id: int) -> bool:
        days_result = await self.db.execute(
            select(TripDayModel.id).where(TripDayModel.trip_id == trip_id)
        )
        day_ids = days_result.scalars().all()
        if day_ids:
            await self.db.execute(
                delete(ItineraryItemModel).where(ItineraryItemModel.trip_day_id.in_(day_ids))
            )

        await self.db.execute(delete(TripDayModel).where(TripDayModel.trip_id == trip_id))
        await self.db.execute(delete(TripMemberModel).where(TripMemberModel.trip_id == trip_id))
        await self.db.execute(delete(TripPreferenceModel).where(TripPreferenceModel.trip_id == trip_id))
        result = await self.db.execute(delete(TripModel).where(TripModel.id == trip_id))
        await self.db.commit()
        return result.rowcount > 0

    async def add_member(self, member: TripMember) -> TripMember:
        db_member = TripMemberModel(
            trip_id=member.trip_id,
            user_id=member.user_id,
            role=member.role,
            status=member.status,
        )
        self.db.add(db_member)
        await self.db.commit()
        await self.db.refresh(db_member)
        return self._to_member_entity(db_member)

    async def upsert_preference(self, preference: TripPreference) -> TripPreference:
        result = await self.db.execute(
            select(TripPreferenceModel).where(TripPreferenceModel.trip_id == preference.trip_id)
        )
        db_preference = result.scalar_one_or_none()

        if db_preference is None:
            db_preference = TripPreferenceModel(trip_id=preference.trip_id)
            self.db.add(db_preference)

        db_preference.atmosphere = TripPreferenceModel.TripAtmosphere(preference.atmosphere.value)
        db_preference.companions = preference.companions
        db_preference.budget = preference.budget
        db_preference.transport_type = preference.transport_type

        await self.db.commit()
        await self.db.refresh(db_preference)
        return self._to_preference_entity(db_preference)

    # 以下はEntityの宣言
    def _to_trip_entity(self, db_trip: TripModel) -> Trip:
        return Trip(
            id=db_trip.id,
            user_id=db_trip.user_id,
            origin=db_trip.origin,
            destination=db_trip.destination,
            start_date=db_trip.start_date,
            end_date=db_trip.end_date,
            status=db_trip.status,
            created_at=db_trip.created_at,
            updated_at=db_trip.updated_at,
        )

    def _to_preference_entity(self, db_preference: TripPreferenceModel) -> TripPreference:
        return TripPreference(
            id=db_preference.id,
            trip_id=db_preference.trip_id,
            atmosphere=TripAtmosphere(db_preference.atmosphere.value),
            companions=db_preference.companions,
            budget=db_preference.budget,
            transport_type=db_preference.transport_type,
            created_at=db_preference.created_at,
        )

    def _to_member_entity(self, db_member: TripMemberModel) -> TripMember:
        return TripMember(
            id=db_member.id,
            trip_id=db_member.trip_id,
            user_id=db_member.user_id,
            role=db_member.role,
            status=db_member.status,
            created_at=db_member.created_at,
            updated_at=db_member.updated_at,
        )

    def _to_day_entity(self, db_day: TripDayModel) -> TripDay:
        return TripDay(
            id=db_day.id,
            trip_id=db_day.trip_id,
            day_number=db_day.day_number,
            date=db_day.date,
            created_at=db_day.created_at,
        )

    def _to_item_entity(self, db_item: ItineraryItemModel) -> ItineraryItem:
        return ItineraryItem(
            id=db_item.id,
            trip_day_id=db_item.trip_day_id,
            name=db_item.name,
            category=db_item.category,
            latitude=db_item.latitude,
            longitude=db_item.longitude,
            start_time=db_item.start_time,
            end_time=db_item.end_time,
            estimated_cost=db_item.estimated_cost,
            notes=db_item.notes,
            created_at=db_item.created_at,
        )
