from datetime import date, datetime
import os
from pathlib import Path
import sys

import pytest

os.environ["DEBUG"] = "false"
os.environ["debug"] = "false"
os.environ["FIREBASE_PROJECT_ID"] = "test-project"

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.application.services.trip_service import TripService
from app.domain.entities.trip import ItineraryItem, Trip, TripAggregate, TripDay
from app.infrastructure.external.google_places_client import PlaceCandidate
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


def test_select_representative_place_item_uses_longest_place_stay():
    service = TripService(FakeTripRepository([]))
    day = TripDay(id=1, trip_id=1, day_number=1, date=date(2026, 4, 1))
    items = [
        ItineraryItem(
            id=1,
            trip_day_id=day.id,
            name="東京駅",
            item_type="place",
            start_time=datetime(2026, 4, 1, 10, 0),
            end_time=datetime(2026, 4, 1, 11, 0),
        ),
        ItineraryItem(
            id=2,
            trip_day_id=day.id,
            name="徒歩で移動",
            item_type="transport",
            start_time=datetime(2026, 4, 1, 11, 0),
            end_time=datetime(2026, 4, 1, 11, 20),
        ),
        ItineraryItem(
            id=3,
            trip_day_id=day.id,
            name="浅草寺",
            item_type="place",
            start_time=datetime(2026, 4, 1, 11, 30),
            end_time=datetime(2026, 4, 1, 14, 0),
        ),
    ]

    representative = service._select_representative_place_item(items)

    assert representative is not None
    assert representative.name == "浅草寺"


def test_merge_generated_itinerary_items_by_scope_from_item_keeps_prefix_and_rebuilds_tail():
    service = TripService(FakeTripRepository([]))
    day = TripDay(id=1, trip_id=1, day_number=1, date=date(2026, 4, 1))
    existing_items = [
        ItineraryItem(id=1, trip_day_id=1, name="東京駅", item_type="place", sequence=1, start_time=datetime(2026, 4, 1, 9, 0)),
        ItineraryItem(id=2, trip_day_id=1, name="移動", item_type="transport", sequence=2, start_time=datetime(2026, 4, 1, 10, 0)),
        ItineraryItem(id=3, trip_day_id=1, name="浅草寺", item_type="place", sequence=3, start_time=datetime(2026, 4, 1, 10, 30)),
        ItineraryItem(id=4, trip_day_id=1, name="移動", item_type="transport", sequence=4, start_time=datetime(2026, 4, 1, 12, 0)),
        ItineraryItem(id=5, trip_day_id=1, name="東京スカイツリー", item_type="place", sequence=5, start_time=datetime(2026, 4, 1, 12, 30)),
    ]
    generated_items = [
        ItineraryItem(id=None, trip_day_id=1, name="東京駅", item_type="place", sequence=1, start_time=datetime(2026, 4, 1, 9, 0)),
        ItineraryItem(id=None, trip_day_id=1, name="移動", item_type="transport", sequence=2, start_time=datetime(2026, 4, 1, 10, 0)),
        ItineraryItem(id=None, trip_day_id=1, name="上野公園", item_type="place", sequence=3, start_time=datetime(2026, 4, 1, 10, 30)),
        ItineraryItem(id=None, trip_day_id=1, name="移動", item_type="transport", sequence=4, start_time=datetime(2026, 4, 1, 12, 0)),
        ItineraryItem(id=None, trip_day_id=1, name="アメ横", item_type="place", sequence=5, start_time=datetime(2026, 4, 1, 12, 30)),
    ]

    merged = service._merge_generated_itinerary_items_by_scope(
        days=[day],
        existing_items=existing_items,
        generated_items=generated_items,
        regeneration_mode="from_item",
        target_item_id=3,
    )

    assert [item.name for item in merged] == ["東京駅", "移動", "上野公園", "移動", "アメ横"]
    assert [item.sequence for item in merged] == [1, 2, 3, 4, 5]


def test_merge_generated_itinerary_items_by_scope_replace_item_swaps_selected_place_block():
    service = TripService(FakeTripRepository([]))
    day = TripDay(id=1, trip_id=1, day_number=1, date=date(2026, 4, 1))
    existing_items = [
        ItineraryItem(id=1, trip_day_id=1, name="東京駅", item_type="place", sequence=1, start_time=datetime(2026, 4, 1, 9, 0)),
        ItineraryItem(id=2, trip_day_id=1, name="移動", item_type="transport", sequence=2, start_time=datetime(2026, 4, 1, 10, 0)),
        ItineraryItem(id=3, trip_day_id=1, name="浅草寺", item_type="place", sequence=3, start_time=datetime(2026, 4, 1, 10, 30)),
        ItineraryItem(id=4, trip_day_id=1, name="移動", item_type="transport", sequence=4, start_time=datetime(2026, 4, 1, 12, 0)),
        ItineraryItem(id=5, trip_day_id=1, name="東京スカイツリー", item_type="place", sequence=5, start_time=datetime(2026, 4, 1, 12, 30)),
    ]
    generated_items = [
        ItineraryItem(id=None, trip_day_id=1, name="東京駅", item_type="place", sequence=1, start_time=datetime(2026, 4, 1, 9, 0)),
        ItineraryItem(id=None, trip_day_id=1, name="移動", item_type="transport", sequence=2, start_time=datetime(2026, 4, 1, 10, 0)),
        ItineraryItem(id=None, trip_day_id=1, name="上野公園", item_type="place", sequence=3, start_time=datetime(2026, 4, 1, 10, 30)),
        ItineraryItem(id=None, trip_day_id=1, name="移動", item_type="transport", sequence=4, start_time=datetime(2026, 4, 1, 12, 0)),
        ItineraryItem(id=None, trip_day_id=1, name="東京スカイツリー", item_type="place", sequence=5, start_time=datetime(2026, 4, 1, 12, 30)),
    ]

    merged = service._merge_generated_itinerary_items_by_scope(
        days=[day],
        existing_items=existing_items,
        generated_items=generated_items,
        regeneration_mode="replace_item",
        target_item_id=3,
    )

    assert [item.name for item in merged] == ["東京駅", "移動", "上野公園", "移動", "東京スカイツリー"]
    assert [item.sequence for item in merged] == [1, 2, 3, 4, 5]


@pytest.mark.asyncio
async def test_update_trip_cover_image_from_itinerary_uses_matching_place_photo(monkeypatch):
    trip = make_trip(1, destination="箱根")
    repository = FakeTripRepository([trip])
    service = TripService(repository)
    itinerary_items = [
        ItineraryItem(
            id=1,
            trip_day_id=1,
            name="箱根湯本駅",
            item_type="place",
            start_time=datetime(2026, 4, 1, 10, 30),
            end_time=datetime(2026, 4, 1, 12, 5),
            latitude=35.2329,
            longitude=139.1068,
        ),
        ItineraryItem(
            id=2,
            trip_day_id=1,
            name="Bakery & Table 箱根",
            item_type="place",
            start_time=datetime(2026, 4, 1, 12, 30),
            end_time=datetime(2026, 4, 1, 13, 50),
            latitude=35.2032,
            longitude=139.0246,
        ),
    ]
    fallback_candidates = [
        PlaceCandidate(
            name="Bakery & Table 箱根",
            latitude=35.2032,
            longitude=139.0246,
            photo_name="places/example/photos/photo-1",
        )
    ]

    class FakeGooglePlacesClient:
        async def search_text(self, query: str, max_results: int = 10, language_code=None, region_code=None):
            return []

        async def get_photo_media(self, photo_name: str, *, max_width_px: int = 1200, max_height_px: int = 900):
            assert photo_name == "places/example/photos/photo-1"
            return "https://places.googleapis.com/v1/photo-media/example"

    monkeypatch.setattr("app.application.services.trip_service.GooglePlacesClient", FakeGooglePlacesClient)

    updated = await service._update_trip_cover_image_from_itinerary(
        trip=trip,
        itinerary_items=itinerary_items,
        fallback_candidates=fallback_candidates,
    )

    assert updated is True
    assert trip.cover_image_url == "https://places.googleapis.com/v1/photo-media/example"
    assert repository.update_calls == [1]
