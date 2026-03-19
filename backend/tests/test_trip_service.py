from datetime import date
import os
from pathlib import Path
import sys

import pytest

os.environ["DEBUG"] = "false"
os.environ["debug"] = "false"
os.environ["FIREBASE_PROJECT_ID"] = "test-project"

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.application.services.trip_service import TripService
from app.domain.entities.trip import Trip, TripAggregate
from app.shared.exceptions import TripNotFoundError


class FakeTripRepository:
    def __init__(self, trips: list[Trip]):
        self.trips = {trip.id: trip for trip in trips}
        self.activate_calls: list[int] = []
        self.update_calls: list[int] = []

    async def create_trip(self, trip, preference=None):
        raise NotImplementedError

    async def get_trip_aggregate(self, trip_id: int):
        trip = self.trips.get(trip_id)
        if trip is None:
            return None
        return TripAggregate(trip=trip)

    async def list_by_user(self, user_id: int, skip: int = 0, limit: int = 100):
        return [trip for trip in self.trips.values() if trip.user_id == user_id][:limit]

    async def update_trip(self, trip: Trip):
        self.update_calls.append(trip.id)
        self.trips[trip.id] = trip
        return trip

    async def activate_trip_for_user(self, trip: Trip):
        self.activate_calls.append(trip.id)
        for candidate in self.trips.values():
            if candidate.user_id != trip.user_id or candidate.id == trip.id:
                continue
            if candidate.status == "ongoing":
                candidate.status = "planned"
        self.trips[trip.id] = trip
        return trip

    async def delete_trip(self, trip_id: int):
        raise NotImplementedError

    async def add_member(self, member):
        raise NotImplementedError

    async def get_member(self, trip_id: int, user_id: int):
        raise NotImplementedError

    async def update_member(self, member):
        raise NotImplementedError

    async def delete_member(self, trip_id: int, user_id: int):
        raise NotImplementedError

    async def upsert_preference(self, preference):
        raise NotImplementedError

    async def create_day(self, day):
        raise NotImplementedError

    async def get_day(self, day_id: int):
        raise NotImplementedError

    async def update_day(self, day):
        raise NotImplementedError

    async def delete_day(self, day_id: int):
        raise NotImplementedError

    async def create_item(self, item):
        raise NotImplementedError

    async def get_item(self, item_id: int):
        raise NotImplementedError

    async def update_item(self, item):
        raise NotImplementedError

    async def delete_item(self, item_id: int):
        raise NotImplementedError

    async def create_incident(self, incident):
        raise NotImplementedError

    async def list_incidents(self, trip_id: int):
        raise NotImplementedError

    async def get_incident(self, incident_id: int):
        raise NotImplementedError

    async def create_replan_session(self, session, items=None):
        raise NotImplementedError

    async def get_replan_aggregate(self, session_id: int):
        raise NotImplementedError

    async def create_ai_plan_generation(self, generation):
        raise NotImplementedError

    async def get_ai_plan_generation(self, generation_id: int):
        raise NotImplementedError

    async def update_ai_plan_generation(self, generation):
        raise NotImplementedError

    async def list_days_by_trip(self, trip_id: int):
        raise NotImplementedError

    async def delete_items_by_trip(self, trip_id: int):
        raise NotImplementedError

    async def replace_items_by_trip(self, trip_id: int, items):
        raise NotImplementedError


def make_trip(trip_id: int, *, user_id: int = 1, status: str = "planned", destination: str = "大阪") -> Trip:
    return Trip(
        id=trip_id,
        user_id=user_id,
        origin="東京",
        destination=destination,
        start_date=date(2026, 4, 1),
        end_date=date(2026, 4, 3),
        participant_count=2,
        status=status,
    )


@pytest.mark.asyncio
async def test_update_my_trip_activates_target_and_resets_other_ongoing_trips():
    repository = FakeTripRepository(
        [
            make_trip(1, status="ongoing", destination="京都"),
            make_trip(2, status="planned", destination="大阪"),
        ]
    )
    service = TripService(repository)

    updated = await service.update_my_trip(user_id=1, trip_id=2, status="ongoing")

    assert updated.status == "ongoing"
    assert repository.trips[1].status == "planned"
    assert repository.trips[2].status == "ongoing"
    assert repository.activate_calls == [2]
    assert repository.update_calls == []


@pytest.mark.asyncio
async def test_update_my_trip_with_non_status_changes_does_not_reset_other_trips():
    repository = FakeTripRepository(
        [
            make_trip(1, status="ongoing", destination="京都"),
            make_trip(2, status="planned", destination="大阪"),
        ]
    )
    service = TripService(repository)

    updated = await service.update_my_trip(user_id=1, trip_id=2, destination="神戸")

    assert updated.destination == "神戸"
    assert repository.trips[1].status == "ongoing"
    assert repository.activate_calls == []
    assert repository.update_calls == [2]


@pytest.mark.asyncio
async def test_update_my_trip_rejects_invalid_status():
    repository = FakeTripRepository([make_trip(1, status="planned")])
    service = TripService(repository)

    with pytest.raises(ValueError, match="status must be one of planned, ongoing, completed"):
        await service.update_my_trip(user_id=1, trip_id=1, status="invalid")


@pytest.mark.asyncio
async def test_update_my_trip_status_ongoing_is_noop_when_already_ongoing():
    repository = FakeTripRepository([make_trip(1, status="ongoing")])
    service = TripService(repository)

    updated = await service.update_my_trip(user_id=1, trip_id=1, status="ongoing")

    assert updated.status == "ongoing"
    assert repository.activate_calls == []
    assert repository.update_calls == []


@pytest.mark.asyncio
async def test_update_my_trip_raises_when_trip_is_missing():
    repository = FakeTripRepository([])
    service = TripService(repository)

    with pytest.raises(TripNotFoundError):
        await service.update_my_trip(user_id=1, trip_id=99, status="ongoing")
