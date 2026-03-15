from datetime import date
from typing import Optional

from app.domain.entities.trip import ItineraryItem, Trip, TripAggregate, TripDay, TripMember, TripPreference
from app.domain.entities.trip import Incident, ReplanAggregate, ReplanItem, ReplanSession
from app.domain.repositories.trip_repository import TripRepository
from app.shared.exceptions import (
    IncidentNotFoundError,
    ItineraryItemNotFoundError,
    PermissionDeniedError,
    ReplanSessionNotFoundError,
    TripDayNotFoundError,
    TripNotFoundError,
)


class TripService:
    """Trip application service."""

    def __init__(self, trip_repository: TripRepository):
        self.trip_repository = trip_repository

    async def create_trip(
        self,
        user_id: int,
        trip: Trip,
        preference: Optional[TripPreference] = None,
    ) -> TripAggregate:
        trip.user_id = user_id
        return await self.trip_repository.create_trip(trip, preference)

    async def list_my_trips(self, user_id: int, skip: int = 0, limit: int = 100) -> list[Trip]:
        return await self.trip_repository.list_by_user(user_id, skip=skip, limit=limit)

    async def get_my_trip_detail(self, user_id: int, trip_id: int) -> TripAggregate:
        aggregate = await self.trip_repository.get_trip_aggregate(trip_id)
        if aggregate is None:
            raise TripNotFoundError(f"Trip with ID {trip_id} not found")
        if aggregate.trip.user_id != user_id:
            raise PermissionDeniedError("You do not have access to this trip")
        return aggregate

    async def update_my_trip(self, user_id: int, trip_id: int, **kwargs) -> Trip:
        aggregate = await self.get_my_trip_detail(user_id=user_id, trip_id=trip_id)
        trip = aggregate.trip

        for key, value in kwargs.items():
            if value is not None and hasattr(trip, key):
                setattr(trip, key, value)

        updated = await self.trip_repository.update_trip(trip)
        if updated is None:
            raise TripNotFoundError(f"Trip with ID {trip_id} not found")
        return updated

    async def delete_my_trip(self, user_id: int, trip_id: int) -> bool:
        await self.get_my_trip_detail(user_id=user_id, trip_id=trip_id)
        deleted = await self.trip_repository.delete_trip(trip_id)
        if not deleted:
            raise TripNotFoundError(f"Trip with ID {trip_id} not found")
        return True

    async def upsert_my_preference(
        self,
        user_id: int,
        trip_id: int,
        preference: TripPreference,
    ) -> TripPreference:
        await self.get_my_trip_detail(user_id=user_id, trip_id=trip_id)
        preference.trip_id = trip_id
        return await self.trip_repository.upsert_preference(preference)

    async def add_my_member(
        self,
        owner_user_id: int,
        trip_id: int,
        member_user_id: int,
        role: str = "member",
        status: str = "joined",
    ) -> TripMember:
        await self.get_my_trip_detail(user_id=owner_user_id, trip_id=trip_id)
        member = TripMember(
            id=None,
            trip_id=trip_id,
            user_id=member_user_id,
            role=role,
            status=status,
        )
        return await self.trip_repository.add_member(member)

    async def update_my_member(
        self,
        owner_user_id: int,
        trip_id: int,
        member_user_id: int,
        role: str | None = None,
        status: str | None = None,
    ) -> TripMember:
        await self.get_my_trip_detail(user_id=owner_user_id, trip_id=trip_id)
        member = await self.trip_repository.get_member(trip_id=trip_id, user_id=member_user_id)
        if member is None:
            raise TripNotFoundError(
                f"Trip member user_id={member_user_id} not found in trip {trip_id}"
            )

        if role is not None:
            member.role = role
        if status is not None:
            member.status = status

        updated_member = await self.trip_repository.update_member(member)
        if updated_member is None:
            raise TripNotFoundError(
                f"Trip member user_id={member_user_id} not found in trip {trip_id}"
            )
        return updated_member

    async def delete_my_member(self, owner_user_id: int, trip_id: int, member_user_id: int) -> bool:
        await self.get_my_trip_detail(user_id=owner_user_id, trip_id=trip_id)
        deleted = await self.trip_repository.delete_member(trip_id=trip_id, user_id=member_user_id)
        if not deleted:
            raise TripNotFoundError(
                f"Trip member user_id={member_user_id} not found in trip {trip_id}"
            )
        return True

    async def add_my_day(
        self,
        owner_user_id: int,
        trip_id: int,
        day_number: int,
        day_date: date | None,
    ) -> TripDay:
        await self.get_my_trip_detail(user_id=owner_user_id, trip_id=trip_id)
        day = TripDay(
            id=None,
            trip_id=trip_id,
            day_number=day_number,
            date=day_date,
        )
        return await self.trip_repository.create_day(day)

    async def update_my_day(
        self,
        owner_user_id: int,
        trip_id: int,
        day_id: int,
        day_number: int | None = None,
        day_date: date | None = None,
    ) -> TripDay:
        await self.get_my_trip_detail(user_id=owner_user_id, trip_id=trip_id)
        day = await self.trip_repository.get_day(day_id)
        if day is None or day.trip_id != trip_id:
            raise TripDayNotFoundError(f"Trip day with ID {day_id} not found in trip {trip_id}")

        if day_number is not None:
            day.day_number = day_number
        if day_date is not None:
            day.date = day_date

        updated_day = await self.trip_repository.update_day(day)
        if updated_day is None:
            raise TripDayNotFoundError(f"Trip day with ID {day_id} not found in trip {trip_id}")
        return updated_day

    async def delete_my_day(self, owner_user_id: int, trip_id: int, day_id: int) -> bool:
        await self.get_my_trip_detail(user_id=owner_user_id, trip_id=trip_id)
        day = await self.trip_repository.get_day(day_id)
        if day is None or day.trip_id != trip_id:
            raise TripDayNotFoundError(f"Trip day with ID {day_id} not found in trip {trip_id}")

        deleted = await self.trip_repository.delete_day(day_id)
        if not deleted:
            raise TripDayNotFoundError(f"Trip day with ID {day_id} not found in trip {trip_id}")
        return True

    async def add_my_item(
        self,
        owner_user_id: int,
        trip_id: int,
        day_id: int,
        item: ItineraryItem,
    ) -> ItineraryItem:
        await self.get_my_trip_detail(user_id=owner_user_id, trip_id=trip_id)
        day = await self.trip_repository.get_day(day_id)
        if day is None or day.trip_id != trip_id:
            raise TripDayNotFoundError(f"Trip day with ID {day_id} not found in trip {trip_id}")

        item.trip_day_id = day_id
        return await self.trip_repository.create_item(item)

    async def update_my_item(
        self,
        owner_user_id: int,
        trip_id: int,
        day_id: int,
        item_id: int,
        **kwargs,
    ) -> ItineraryItem:
        await self.get_my_trip_detail(user_id=owner_user_id, trip_id=trip_id)
        day = await self.trip_repository.get_day(day_id)
        if day is None or day.trip_id != trip_id:
            raise TripDayNotFoundError(f"Trip day with ID {day_id} not found in trip {trip_id}")

        item = await self.trip_repository.get_item(item_id)
        if item is None or item.trip_day_id != day_id:
            raise ItineraryItemNotFoundError(
                f"Itinerary item with ID {item_id} not found in day {day_id}"
            )

        for key, value in kwargs.items():
            if value is not None and hasattr(item, key):
                setattr(item, key, value)

        updated_item = await self.trip_repository.update_item(item)
        if updated_item is None:
            raise ItineraryItemNotFoundError(
                f"Itinerary item with ID {item_id} not found in day {day_id}"
            )
        return updated_item

    async def delete_my_item(self, owner_user_id: int, trip_id: int, day_id: int, item_id: int) -> bool:
        await self.get_my_trip_detail(user_id=owner_user_id, trip_id=trip_id)
        day = await self.trip_repository.get_day(day_id)
        if day is None or day.trip_id != trip_id:
            raise TripDayNotFoundError(f"Trip day with ID {day_id} not found in trip {trip_id}")

        item = await self.trip_repository.get_item(item_id)
        if item is None or item.trip_day_id != day_id:
            raise ItineraryItemNotFoundError(
                f"Itinerary item with ID {item_id} not found in day {day_id}"
            )

        deleted = await self.trip_repository.delete_item(item_id)
        if not deleted:
            raise ItineraryItemNotFoundError(
                f"Itinerary item with ID {item_id} not found in day {day_id}"
            )
        return True

    async def create_my_incident(
        self,
        owner_user_id: int,
        trip_id: int,
        incident: Incident,
    ) -> Incident:
        await self.get_my_trip_detail(user_id=owner_user_id, trip_id=trip_id)
        incident.trip_id = trip_id
        return await self.trip_repository.create_incident(incident)

    async def list_my_incidents(self, owner_user_id: int, trip_id: int) -> list[Incident]:
        await self.get_my_trip_detail(user_id=owner_user_id, trip_id=trip_id)
        return await self.trip_repository.list_incidents(trip_id)

    async def create_my_replan_session(
        self,
        owner_user_id: int,
        trip_id: int,
        session: ReplanSession,
        items: Optional[list[ReplanItem]] = None,
    ) -> ReplanAggregate:
        await self.get_my_trip_detail(user_id=owner_user_id, trip_id=trip_id)
        session.trip_id = trip_id

        if session.incident_id is not None:
            incident = await self.trip_repository.get_incident(session.incident_id)
            if incident is None or incident.trip_id != trip_id:
                raise IncidentNotFoundError(
                    f"Incident with ID {session.incident_id} not found in trip {trip_id}"
                )

        return await self.trip_repository.create_replan_session(session, items)

    async def get_my_replan_detail(
        self,
        owner_user_id: int,
        trip_id: int,
        session_id: int,
    ) -> ReplanAggregate:
        await self.get_my_trip_detail(user_id=owner_user_id, trip_id=trip_id)
        aggregate = await self.trip_repository.get_replan_aggregate(session_id)
        if aggregate is None or aggregate.session.trip_id != trip_id:
            raise ReplanSessionNotFoundError(
                f"Replan session with ID {session_id} not found in trip {trip_id}"
            )
        return aggregate
