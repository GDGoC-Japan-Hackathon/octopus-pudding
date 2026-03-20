import asyncio
import json
import logging
from datetime import date, datetime, time, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from app.domain.entities.trip import (
    AiPlanGeneration,
    Incident,
    ItineraryItem,
    ReplanAggregate,
    ReplanItem,
    ReplanSession,
    Trip,
    TripAggregate,
    TripAtmosphere,
    TripDay,
    TripMember,
    TripPreference,
)
from app.domain.repositories.trip_repository import TripRepository
from app.infrastructure.external import (
    GeminiClient,
    GooglePlacesClient,
    PlaceCandidate,
    RouteOption,
    RoutesClient,
    RouteStep,
)
from app.shared.exceptions import (
    AiPlanGenerationNotFoundError,
    IncidentNotFoundError,
    ItineraryItemNotFoundError,
    PermissionDeniedError,
    ReplanSessionNotFoundError,
    TripDayNotFoundError,
    TripNotFoundError,
)

logger = logging.getLogger(__name__)


def build_trip_recommendation_comment(
    destination: str,
    preference: Optional[TripPreference],
    recommendation_categories: list[str],
) -> str:
    target = _comment_target_phrase(destination, preference.companions if preference is not None else None)
    vibe = _comment_vibe_phrase(preference.atmosphere.value if preference is not None else None)
    category_hint = _comment_category_phrase(recommendation_categories)
    if category_hint:
        return f"{target} {vibe}、{category_hint}プランです。"
    return f"{target} {vibe}体験型プランです。"


def _comment_target_phrase(destination: str, companions: Optional[str]) -> str:
    normalized = (companions or "").strip().lower()
    if normalized == "couple":
        return "デートにおすすめ！"
    if normalized == "friends":
        return "友達同士におすすめ！"
    if normalized == "family":
        return "家族旅行におすすめ！"
    if normalized == "solo":
        return "ひとり旅におすすめ！"
    if destination:
        return f"{destination}観光におすすめ！"
    return "気軽なおでかけにおすすめ！"


def _comment_vibe_phrase(atmosphere: Optional[str]) -> str:
    if atmosphere == "のんびり":
        return "のんびり楽しめる"
    if atmosphere == "アクティブ":
        return "アクティブに回れる"
    if atmosphere == "映え":
        return "写真映えを楽しめる"
    if atmosphere == "グルメ":
        return "グルメを満喫できる"
    return "気軽に楽しめる"


def _comment_category_phrase(recommendation_categories: list[str]) -> Optional[str]:
    categories = recommendation_categories or []
    if "夜景" in categories:
        return "夜まで楽しめる"
    if "グルメ" in categories:
        return "食べ歩きも楽しめる"
    if "温泉" in categories:
        return "癒やしも味わえる"
    if "カフェ" in categories:
        return "カフェ巡りを楽しめる"
    return None


def _normalize_generation_text_items(values: Optional[list[str]]) -> list[str]:
    if not values:
        return []
    normalized: list[str] = []
    for value in values:
        item = (value or "").strip()
        if item:
            normalized.append(item)
    return normalized


def _normalize_generation_text_items_by_day(values: Optional[list[Optional[str]]]) -> list[Optional[str]]:
    if not values:
        return []
    normalized: list[Optional[str]] = []
    for value in values:
        item = (value or "").strip()
        normalized.append(item or None)
    return normalized


class TripService:
    """Trip application service."""

    ALLOWED_RECOMMENDATION_CATEGORIES = {"カフェ", "夜景", "グルメ", "温泉"}
    ALLOWED_TRIP_STATUSES = {"planned", "ongoing", "completed"}
    MAX_PARTICIPANT_COUNT = 10
    MAX_TRIP_DAYS = 3
    MAX_ROUTE_CANDIDATES = 8
    MAX_NEAREST_DESTINATIONS_PER_CANDIDATE = 3
    ACTIVITY_START_TIME = "09:00"
    ACTIVITY_END_TIME = "22:00"
    LOCAL_DESTINATION_RADIUS_METERS = 80_000
    WIDE_DESTINATION_RADIUS_METERS = 350_000
    PREFECTURE_TOKENS = (
        "北海道",
        "青森県",
        "岩手県",
        "宮城県",
        "秋田県",
        "山形県",
        "福島県",
        "茨城県",
        "栃木県",
        "群馬県",
        "埼玉県",
        "千葉県",
        "東京都",
        "神奈川県",
        "新潟県",
        "富山県",
        "石川県",
        "福井県",
        "山梨県",
        "長野県",
        "岐阜県",
        "静岡県",
        "愛知県",
        "三重県",
        "滋賀県",
        "京都府",
        "大阪府",
        "兵庫県",
        "奈良県",
        "和歌山県",
        "鳥取県",
        "島根県",
        "岡山県",
        "広島県",
        "山口県",
        "徳島県",
        "香川県",
        "愛媛県",
        "高知県",
        "福岡県",
        "佐賀県",
        "長崎県",
        "熊本県",
        "大分県",
        "宮崎県",
        "鹿児島県",
        "沖縄県",
    )
    _SUSPECT_LOCATION_WORDS = {"test", "testing", "aaa", "aaaa", "abcde", "qwerty"}

    def __init__(self, trip_repository: TripRepository):
        self.trip_repository = trip_repository

    async def create_trip(
        self,
        user_id: int,
        trip: Trip,
        preference: Optional[TripPreference] = None,
    ) -> TripAggregate:
        if trip.participant_count < 1:
            raise ValueError("participant_count must be greater than or equal to 1")
        if trip.participant_count > self.MAX_PARTICIPANT_COUNT:
            raise ValueError(f"participant_count must be less than or equal to {self.MAX_PARTICIPANT_COUNT}")
        if (trip.end_date - trip.start_date).days + 1 > self.MAX_TRIP_DAYS:
            raise ValueError(f"trip duration must be less than or equal to {self.MAX_TRIP_DAYS} days")
        if trip.save_count < 0:
            raise ValueError("save_count must be greater than or equal to 0")
        invalid_categories = [
            category
            for category in trip.recommendation_categories
            if category not in self.ALLOWED_RECOMMENDATION_CATEGORIES
        ]
        if invalid_categories:
            raise ValueError("recommendation_categories contains invalid values")
        self._validate_location_like_text(trip.origin, "出発地")
        self._validate_location_like_text(trip.destination, "目的地")
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
        current_status = trip.status
        next_start_date = kwargs.get("start_date") if kwargs.get("start_date") is not None else trip.start_date
        next_end_date = kwargs.get("end_date") if kwargs.get("end_date") is not None else trip.end_date
        next_participant_count = (
            kwargs.get("participant_count") if kwargs.get("participant_count") is not None else trip.participant_count
        )

        if "participant_count" in kwargs and kwargs["participant_count"] is not None:
            if kwargs["participant_count"] < 1:
                raise ValueError("participant_count must be greater than or equal to 1")
        if next_participant_count > self.MAX_PARTICIPANT_COUNT:
            raise ValueError(f"participant_count must be less than or equal to {self.MAX_PARTICIPANT_COUNT}")
        if (next_end_date - next_start_date).days + 1 > self.MAX_TRIP_DAYS:
            raise ValueError(f"trip duration must be less than or equal to {self.MAX_TRIP_DAYS} days")
        if "save_count" in kwargs and kwargs["save_count"] is not None:
            if kwargs["save_count"] < 0:
                raise ValueError("save_count must be greater than or equal to 0")
        if "status" in kwargs and kwargs["status"] is not None:
            if kwargs["status"] not in self.ALLOWED_TRIP_STATUSES:
                raise ValueError("status must be one of planned, ongoing, completed")
        if "recommendation_categories" in kwargs and kwargs["recommendation_categories"] is not None:
            invalid_categories = [
                category
                for category in kwargs["recommendation_categories"]
                if category not in self.ALLOWED_RECOMMENDATION_CATEGORIES
            ]
            if invalid_categories:
                raise ValueError("recommendation_categories contains invalid values")
        if "origin" in kwargs and kwargs["origin"] is not None:
            self._validate_location_like_text(str(kwargs["origin"]), "出発地")
        if "destination" in kwargs and kwargs["destination"] is not None:
            self._validate_location_like_text(str(kwargs["destination"]), "目的地")

        for key, value in kwargs.items():
            if value is not None and hasattr(trip, key):
                setattr(trip, key, value)

        if kwargs.get("status") == "ongoing" and current_status == "ongoing":
            if set(kwargs.keys()) == {"status"}:
                return trip
            updated = await self.trip_repository.update_trip(trip)
        elif kwargs.get("status") == "ongoing":
            updated = await self.trip_repository.activate_trip_for_user(trip)
        else:
            updated = await self.trip_repository.update_trip(trip)
        if updated is None:
            raise TripNotFoundError(f"Trip with ID {trip_id} not found")
        if "start_date" in kwargs or "end_date" in kwargs:
            await self._sync_trip_days_to_range(
                trip_id=updated.id,
                start_date=updated.start_date,
                end_date=updated.end_date,
            )
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
        atmosphere,
        *,
        companions: Optional[str] = None,
        budget: Optional[int] = None,
        transport_type: Optional[str] = None,
        must_visit_places_text: Optional[str] = None,
        additional_request_comment: Optional[str] = None,
        fields_set: Optional[set[str]] = None,
    ) -> TripPreference:
        aggregate = await self.get_my_trip_detail(user_id=user_id, trip_id=trip_id)
        current = aggregate.preference
        preference = TripPreference(
            id=current.id if current is not None else None,
            trip_id=trip_id,
            atmosphere=atmosphere,
            companions=current.companions if current is not None else None,
            budget=current.budget if current is not None else None,
            transport_type=current.transport_type if current is not None else None,
            must_visit_places_text=(current.must_visit_places_text if current is not None else None),
            additional_request_comment=(current.additional_request_comment if current is not None else None),
        )

        writable_fields = {
            "companions",
            "budget",
            "transport_type",
            "must_visit_places_text",
            "additional_request_comment",
        }
        effective_fields = writable_fields if fields_set is None else writable_fields.intersection(fields_set)
        if "companions" in effective_fields:
            preference.companions = companions
        if "budget" in effective_fields:
            preference.budget = budget
        if "transport_type" in effective_fields:
            preference.transport_type = transport_type
        if "must_visit_places_text" in effective_fields:
            preference.must_visit_places_text = must_visit_places_text
        if "additional_request_comment" in effective_fields:
            preference.additional_request_comment = additional_request_comment

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
            raise TripNotFoundError(f"Trip member user_id={member_user_id} not found in trip {trip_id}")

        if role is not None:
            member.role = role
        if status is not None:
            member.status = status

        updated_member = await self.trip_repository.update_member(member)
        if updated_member is None:
            raise TripNotFoundError(f"Trip member user_id={member_user_id} not found in trip {trip_id}")
        return updated_member

    async def delete_my_member(self, owner_user_id: int, trip_id: int, member_user_id: int) -> bool:
        await self.get_my_trip_detail(user_id=owner_user_id, trip_id=trip_id)
        deleted = await self.trip_repository.delete_member(trip_id=trip_id, user_id=member_user_id)
        if not deleted:
            raise TripNotFoundError(f"Trip member user_id={member_user_id} not found in trip {trip_id}")
        return True

    async def add_my_day(
        self,
        owner_user_id: int,
        trip_id: int,
        day_number: int,
        day_date: date | None,
        lodging_note: str | None = None,
    ) -> TripDay:
        await self.get_my_trip_detail(user_id=owner_user_id, trip_id=trip_id)
        day = TripDay(
            id=None,
            trip_id=trip_id,
            day_number=day_number,
            date=day_date,
            lodging_note=lodging_note,
        )
        return await self.trip_repository.create_day(day)

    async def update_my_day(
        self,
        owner_user_id: int,
        trip_id: int,
        day_id: int,
        day_number: int | None = None,
        day_date: date | None = None,
        lodging_note: str | None = None,
        apply_day_date: bool = False,
        apply_lodging_note: bool = False,
    ) -> TripDay:
        await self.get_my_trip_detail(user_id=owner_user_id, trip_id=trip_id)
        day = await self.trip_repository.get_day(day_id)
        if day is None or day.trip_id != trip_id:
            raise TripDayNotFoundError(f"Trip day with ID {day_id} not found in trip {trip_id}")

        if day_number is not None:
            day.day_number = day_number
        if apply_day_date:
            day.date = day_date
        if apply_lodging_note:
            day.lodging_note = lodging_note

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
            raise ItineraryItemNotFoundError(f"Itinerary item with ID {item_id} not found in day {day_id}")

        for key, value in kwargs.items():
            if value is not None and hasattr(item, key):
                setattr(item, key, value)

        updated_item = await self.trip_repository.update_item(item)
        if updated_item is None:
            raise ItineraryItemNotFoundError(f"Itinerary item with ID {item_id} not found in day {day_id}")
        return updated_item

    async def delete_my_item(self, owner_user_id: int, trip_id: int, day_id: int, item_id: int) -> bool:
        await self.get_my_trip_detail(user_id=owner_user_id, trip_id=trip_id)
        day = await self.trip_repository.get_day(day_id)
        if day is None or day.trip_id != trip_id:
            raise TripDayNotFoundError(f"Trip day with ID {day_id} not found in trip {trip_id}")

        item = await self.trip_repository.get_item(item_id)
        if item is None or item.trip_day_id != day_id:
            raise ItineraryItemNotFoundError(f"Itinerary item with ID {item_id} not found in day {day_id}")

        deleted = await self.trip_repository.delete_item(item_id)
        if not deleted:
            raise ItineraryItemNotFoundError(f"Itinerary item with ID {item_id} not found in day {day_id}")
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
                raise IncidentNotFoundError(f"Incident with ID {session.incident_id} not found in trip {trip_id}")

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
            raise ReplanSessionNotFoundError(f"Replan session with ID {session_id} not found in trip {trip_id}")
        return aggregate

    async def start_my_ai_plan_generation(
        self,
        owner_user_id: int,
        trip_id: int,
        origin: Optional[dict] = None,
        destination: Optional[dict] = None,
        lodging: Optional[dict] = None,
        provider: Optional[str] = None,
        prompt_version: Optional[str] = None,
        run_async: bool = True,
        regeneration_mode: str = "full",
        target_day_id: Optional[int] = None,
        target_item_id: Optional[int] = None,
        must_visit_places: Optional[list[str]] = None,
        lodging_notes: Optional[list[str]] = None,
        additional_request_comment: Optional[str] = None,
        selected_companion_names: Optional[list[str]] = None,
        incident_type: Optional[str] = None,
        incident_note: Optional[str] = None,
        delay_minutes: Optional[int] = None,
        adjustment_policies: Optional[list[str]] = None,
    ) -> AiPlanGeneration:
        generation_input = {
            "must_visit_places": [],
            "lodging_notes": [],
            "additional_request_comment": None,
            "selected_companion_names": [],
            "origin": None,
            "destination": None,
            "lodging": None,
            "incident_type": None,
            "incident_note": None,
            "delay_minutes": None,
            "adjustment_policies": [],
        }

        aggregate = await self.get_my_trip_detail(user_id=owner_user_id, trip_id=trip_id)
        normalized_regeneration_mode = self._normalize_regeneration_mode(regeneration_mode)
        self._validate_ai_generation_scope(
            aggregate=aggregate,
            regeneration_mode=normalized_regeneration_mode,
            target_item_id=target_item_id,
        )
        days = await self._sync_trip_days_to_range(
            trip_id=trip_id,
            start_date=aggregate.trip.start_date,
            end_date=aggregate.trip.end_date,
        )

        normalized_must_visit_places = _normalize_generation_text_items(must_visit_places)
        normalized_lodging_notes = _normalize_generation_text_items_by_day(lodging_notes)
        normalized_additional_comment = (additional_request_comment or "").strip() or None
        normalized_incident_type = (incident_type or "").strip() or None
        normalized_incident_note = (incident_note or "").strip() or None
        normalized_delay_minutes = (
            int(delay_minutes)
            if isinstance(delay_minutes, int) and not isinstance(delay_minutes, bool) and delay_minutes > 0
            else None
        )
        normalized_adjustment_policies = _normalize_generation_text_items(adjustment_policies)
        self._validate_location_like_text(aggregate.trip.origin, "出発地")
        self._validate_location_like_text(aggregate.trip.destination, "目的地")
        for lodging_note in normalized_lodging_notes:
            if lodging_note:
                self._validate_location_like_text(lodging_note, "宿泊地")

        await self.upsert_my_preference(
            user_id=owner_user_id,
            trip_id=trip_id,
            atmosphere=(
                aggregate.preference.atmosphere if aggregate.preference is not None else TripAtmosphere.RELAXED
            ),
            must_visit_places_text=("\n".join(normalized_must_visit_places) or None),
            additional_request_comment=normalized_additional_comment,
            fields_set={"must_visit_places_text", "additional_request_comment"},
        )

        for day_index, day in enumerate(days):
            lodging_note = normalized_lodging_notes[day_index] if day_index < len(normalized_lodging_notes) else None
            await self.trip_repository.update_day(
                TripDay(
                    id=day.id,
                    trip_id=day.trip_id,
                    day_number=day.day_number,
                    date=day.date,
                    lodging_note=lodging_note,
                )
            )

        refreshed_aggregate = await self.trip_repository.get_trip_aggregate(trip_id)
        refreshed_preference = (
            refreshed_aggregate.preference if refreshed_aggregate is not None else aggregate.preference
        )
        refreshed_days = refreshed_aggregate.days if refreshed_aggregate is not None else days
        persisted_companion_names = await self.trip_repository.list_member_names_by_trip(
            trip_id,
            exclude_user_id=owner_user_id,
        )
        if not persisted_companion_names:
            persisted_companion_names = _normalize_generation_text_items(selected_companion_names)

        generation_input = {
            "regeneration_mode": normalized_regeneration_mode,
            "target_day_id": target_day_id,
            "target_item_id": target_item_id,
            "must_visit_places": _normalize_generation_text_items(
                (refreshed_preference.must_visit_places_text or "").splitlines()
                if refreshed_preference is not None and refreshed_preference.must_visit_places_text
                else []
            ),
            "lodging_notes": [((day.lodging_note or "").strip() or None) for day in refreshed_days],
            "additional_request_comment": (
                refreshed_preference.additional_request_comment if refreshed_preference is not None else None
            ),
            "selected_companion_names": persisted_companion_names,
            "origin": self._normalize_lat_lng(origin, field_name="origin"),
            "destination": self._normalize_lat_lng(destination, field_name="destination"),
            "lodging": self._normalize_lat_lng(lodging, field_name="lodging") if lodging else None,
            "incident_type": normalized_incident_type,
            "incident_note": normalized_incident_note,
            "delay_minutes": normalized_delay_minutes,
            "adjustment_policies": normalized_adjustment_policies,
        }

        generation = AiPlanGeneration(
            id=None,
            trip_id=trip_id,
            status="queued",
            provider=provider or "google_places+gemini",
            prompt_version=prompt_version or "v1",
        )
        created = await self.trip_repository.create_ai_plan_generation(generation)

        if run_async and created.id is not None:
            asyncio.create_task(self.run_ai_plan_generation_in_background(created.id, generation_input))
        elif created.id is not None:
            created = await self.execute_ai_plan_generation(created.id, generation_input=generation_input)

        return created

    async def get_my_ai_plan_generation(
        self,
        owner_user_id: int,
        trip_id: int,
        generation_id: int,
    ) -> AiPlanGeneration:
        await self.get_my_trip_detail(user_id=owner_user_id, trip_id=trip_id)
        generation = await self.trip_repository.get_ai_plan_generation(generation_id)
        if generation is None or generation.trip_id != trip_id:
            raise AiPlanGenerationNotFoundError(
                f"AI plan generation with ID {generation_id} not found in trip {trip_id}"
            )
        return generation

    @staticmethod
    async def run_ai_plan_generation_in_background(
        generation_id: int,
        generation_input: Optional[dict] = None,
    ) -> None:
        """Run generation with a fresh DB session so request lifecycle does not interfere."""
        from app.infrastructure.database.base import SessionLocal
        from app.infrastructure.repositories.trip_repository_impl import TripRepositoryImpl

        async with SessionLocal() as db:
            repo = TripRepositoryImpl(db)
            service = TripService(repo)
            await service.execute_ai_plan_generation(generation_id, generation_input=generation_input)

    async def execute_ai_plan_generation(
        self,
        generation_id: int,
        generation_input: Optional[dict] = None,
    ) -> AiPlanGeneration:
        generation = await self.trip_repository.get_ai_plan_generation(generation_id)
        if generation is None:
            raise AiPlanGenerationNotFoundError(f"AI plan generation with ID {generation_id} not found")
        if generation.status in {"running", "succeeded"}:
            return generation

        generation.status = "running"
        generation.started_at = datetime.now(timezone.utc)
        generation.finished_at = None
        generation.error_message = None
        generation = await self.trip_repository.update_ai_plan_generation(generation) or generation

        try:
            aggregate = await self.trip_repository.get_trip_aggregate(generation.trip_id)
            if aggregate is None:
                raise TripNotFoundError(f"Trip with ID {generation.trip_id} not found")

            days = await self._ensure_trip_days(aggregate.trip.id, aggregate.trip.start_date, aggregate.trip.end_date)
            place_candidates = await self._collect_place_candidates(
                destination=aggregate.trip.destination,
                preference=aggregate.preference,
                max_candidates=24,
                must_visit_places=(generation_input or {}).get("must_visit_places"),
                destination_location=(generation_input or {}).get("destination"),
                incident_type=(generation_input or {}).get("incident_type"),
                adjustment_policies=(generation_input or {}).get("adjustment_policies"),
            )
            route_options = await self._collect_route_options(
                trip=aggregate.trip,
                days=days,
                place_candidates=place_candidates,
            )
            fallback_used = False
            fallback_reason: str | None = None
            try:
                plan_payload = await self._generate_plan_payload(
                    trip=aggregate.trip,
                    preference=aggregate.preference,
                    days=days,
                    place_candidates=place_candidates,
                    route_options=route_options,
                    generation_input=generation_input,
                )
            except Exception as exc:  # noqa: BLE001
                plan_payload = {}
                fallback_used = True
                fallback_reason = str(exc)[:500]
            normalized = self._normalize_plan_payload(
                plan_payload=plan_payload,
                days=days,
                fallback_candidates=place_candidates,
                route_options=route_options,
                destination=aggregate.trip.destination,
                destination_location=(generation_input or {}).get("destination"),
            )
            normalized, route_diagnostics = await self._rebuild_transport_items_from_routes(
                trip=aggregate.trip,
                days=days,
                normalized_plan=normalized,
                place_candidates=place_candidates,
                origin_location=(generation_input or {}).get("origin"),
                destination_location=(generation_input or {}).get("destination"),
            )
            normalized = self._apply_incident_plan_adjustments(
                normalized_plan=normalized,
                generation_input=generation_input,
            )
            normalized = self._enforce_plan_constraints(
                trip=aggregate.trip,
                days=days,
                normalized_plan=normalized,
            )
            regeneration_mode = self._normalize_regeneration_mode((generation_input or {}).get("regeneration_mode"))
            transit_step_count, transit_line_count = self._count_transit_transport_items(normalized)
            generated_items = self._build_generated_itinerary_items(days=days, normalized_plan=normalized)
            items_to_persist = self._merge_generated_itinerary_items_by_scope(
                days=days,
                existing_items=aggregate.itinerary_items,
                generated_items=generated_items,
                regeneration_mode=regeneration_mode,
                target_item_id=(generation_input or {}).get("target_item_id"),
            )
            inserted_count = await self.trip_repository.replace_items_by_trip(aggregate.trip.id, items_to_persist)
            if not aggregate.trip.recommendation_comment:
                aggregate.trip.recommendation_comment = build_trip_recommendation_comment(
                    destination=aggregate.trip.destination,
                    preference=aggregate.preference,
                    recommendation_categories=aggregate.trip.recommendation_categories,
                )
                await self.trip_repository.update_trip(aggregate.trip)
            cover_image_updated = await self._update_trip_cover_image_from_itinerary(
                trip=aggregate.trip,
                itinerary_items=items_to_persist,
                fallback_candidates=place_candidates,
            )
            generation.status = "succeeded"
            generation.finished_at = datetime.now(timezone.utc)
            generation.error_message = None
            generation.result_summary_json = json.dumps(
                {
                    "trip_id": aggregate.trip.id,
                    "days": len(days),
                    "candidates": len(place_candidates),
                    "inserted_items": inserted_count,
                    "regeneration_mode": regeneration_mode,
                    "incident_type": (generation_input or {}).get("incident_type"),
                    "delay_minutes": (generation_input or {}).get("delay_minutes"),
                    "adjustment_policies": (generation_input or {}).get("adjustment_policies") or [],
                    "transit_step_items": transit_step_count,
                    "transit_line_items": transit_line_count,
                    "transit_attempted_pairs": route_diagnostics.get("transit_attempted_pairs", 0),
                    "transit_succeeded_pairs": route_diagnostics.get("transit_succeeded_pairs", 0),
                    "transit_empty_pairs": route_diagnostics.get("transit_empty_pairs", 0),
                    "transit_timeout_pairs": route_diagnostics.get("transit_timeout_pairs", 0),
                    "transit_exception_pairs": route_diagnostics.get("transit_exception_pairs", 0),
                    "transit_fallback_info_pairs": route_diagnostics.get("transit_fallback_info_pairs", 0),
                    "empty_pairs": route_diagnostics.get("transit_empty_pairs", 0),
                    "timeout_pairs": route_diagnostics.get("transit_timeout_pairs", 0),
                    "walk_fallback_pairs": route_diagnostics.get("walk_fallback_pairs", 0),
                    "drive_fallback_pairs": route_diagnostics.get("drive_fallback_pairs", 0),
                    "cover_image_updated": cover_image_updated,
                    "fallback_used": fallback_used,
                    "fallback_reason": fallback_reason,
                },
                ensure_ascii=False,
            )
        except Exception as exc:  # noqa: BLE001
            generation.status = "failed"
            generation.finished_at = datetime.now(timezone.utc)
            generation.error_message = str(exc)[:2000]

        updated = await self.trip_repository.update_ai_plan_generation(generation)
        return updated or generation

    def _normalize_regeneration_mode(self, raw_mode: Optional[str]) -> str:
        if raw_mode in {"full", "from_item", "replace_item"}:
            return raw_mode
        if raw_mode in {None, ""}:
            return "full"
        raise ValueError("regeneration_mode must be one of full, from_item, replace_item")

    def _validate_ai_generation_scope(
        self,
        *,
        aggregate: TripAggregate,
        regeneration_mode: str,
        target_item_id: Optional[int],
    ) -> None:
        if regeneration_mode == "full":
            return

        if target_item_id is None:
            raise ValueError("target_item_id is required for this regeneration_mode")

        target_item = next((item for item in aggregate.itinerary_items if item.id == target_item_id), None)
        if target_item is None:
            raise ItineraryItemNotFoundError(f"Itinerary item with ID {target_item_id} not found")
        if target_item.item_type != "place":
            raise ValueError("target_item_id must reference a place item")

    def _merge_generated_itinerary_items_by_scope(
        self,
        *,
        days: list[TripDay],
        existing_items: list[ItineraryItem],
        generated_items: list[ItineraryItem],
        regeneration_mode: str,
        target_item_id: Optional[int],
    ) -> list[ItineraryItem]:
        if regeneration_mode == "full":
            return self._resequence_itinerary_items(days=days, items=generated_items)

        if target_item_id is None:
            raise ItineraryItemNotFoundError("target_item_id is required for partial regeneration")

        day_by_id = {day.id: day for day in days if day.id is not None}
        existing_by_day = self._group_itinerary_items_by_day(existing_items)
        generated_by_day = self._group_itinerary_items_by_day(generated_items)
        target_item = next((item for item in existing_items if item.id == target_item_id), None)
        if target_item is None:
            raise ItineraryItemNotFoundError(f"Itinerary item with ID {target_item_id} not found")

        target_day_id = target_item.trip_day_id
        target_day = day_by_id.get(target_day_id)
        if target_day is None:
            raise TripDayNotFoundError(f"Trip day with ID {target_day_id} not found")

        merged_by_day: dict[int, list[ItineraryItem]] = {}
        target_day_number = target_day.day_number
        for day in sorted(days, key=lambda value: value.day_number):
            if day.id is None:
                continue

            if day.day_number < target_day_number:
                merged_by_day[day.id] = list(existing_by_day.get(day.id, []))
                continue

            if day.id == target_day_id:
                if regeneration_mode == "from_item":
                    merged_by_day[day.id] = self._merge_day_from_item(
                        existing_day_items=existing_by_day.get(day.id, []),
                        generated_day_items=generated_by_day.get(day.id, []),
                        target_item_id=target_item_id,
                    )
                elif regeneration_mode == "replace_item":
                    merged_by_day[day.id] = self._merge_day_replace_item(
                        existing_day_items=existing_by_day.get(day.id, []),
                        generated_day_items=generated_by_day.get(day.id, []),
                        target_item_id=target_item_id,
                    )
                else:
                    merged_by_day[day.id] = list(generated_by_day.get(day.id, []))
                continue

            merged_by_day[day.id] = list(generated_by_day.get(day.id, []))

        flattened: list[ItineraryItem] = []
        for day in sorted(days, key=lambda value: value.day_number):
            if day.id is None:
                continue
            flattened.extend(merged_by_day.get(day.id, []))
        return self._resequence_itinerary_items(days=days, items=flattened)

    def _group_itinerary_items_by_day(self, items: list[ItineraryItem]) -> dict[int, list[ItineraryItem]]:
        grouped: dict[int, list[ItineraryItem]] = {}
        for item in items:
            grouped.setdefault(item.trip_day_id, []).append(item)
        return {
            day_id: sorted(values, key=self._itinerary_item_sort_key)
            for day_id, values in grouped.items()
        }

    def _itinerary_item_sort_key(self, item: ItineraryItem) -> tuple[int, float, int]:
        sequence = item.sequence or 9999
        time_value = self._sortable_datetime_value(item.start_time)
        item_id = item.id or 0
        return sequence, time_value, item_id

    def _merge_day_from_item(
        self,
        *,
        existing_day_items: list[ItineraryItem],
        generated_day_items: list[ItineraryItem],
        target_item_id: int,
    ) -> list[ItineraryItem]:
        target_index = next((index for index, item in enumerate(existing_day_items) if item.id == target_item_id), None)
        if target_index is None:
            raise ItineraryItemNotFoundError(f"Itinerary item with ID {target_item_id} not found")

        head = list(existing_day_items[:target_index])
        while head and head[-1].item_type == "transport":
            head.pop()

        start_index = self._find_generated_day_start_index(
            generated_day_items=generated_day_items,
            target_item=existing_day_items[target_index],
        )
        tail = generated_day_items[start_index:] if start_index < len(generated_day_items) else []
        if not tail:
            tail = generated_day_items
        return head + list(tail)

    def _merge_day_replace_item(
        self,
        *,
        existing_day_items: list[ItineraryItem],
        generated_day_items: list[ItineraryItem],
        target_item_id: int,
    ) -> list[ItineraryItem]:
        target_index = next((index for index, item in enumerate(existing_day_items) if item.id == target_item_id), None)
        if target_index is None:
            raise ItineraryItemNotFoundError(f"Itinerary item with ID {target_item_id} not found")

        remove_start = target_index - 1 if target_index > 0 and existing_day_items[target_index - 1].item_type == "transport" else target_index
        remove_end = target_index + 1 if target_index + 1 < len(existing_day_items) and existing_day_items[target_index + 1].item_type == "transport" else target_index

        replacement_block = self._select_generated_replacement_block(
            generated_day_items=generated_day_items,
            target_item=existing_day_items[target_index],
        )
        if not replacement_block:
            return list(existing_day_items)

        return list(existing_day_items[:remove_start]) + replacement_block + list(existing_day_items[remove_end + 1 :])

    def _find_generated_day_start_index(
        self,
        *,
        generated_day_items: list[ItineraryItem],
        target_item: ItineraryItem,
    ) -> int:
        if not generated_day_items:
            return 0

        candidate_index: Optional[int] = None
        if target_item.start_time is not None:
            for index, item in enumerate(generated_day_items):
                if item.item_type != "place" or item.start_time is None:
                    continue
                if item.start_time >= target_item.start_time:
                    candidate_index = index
                    break

        if candidate_index is None:
            for index, item in enumerate(generated_day_items):
                if item.item_type == "place":
                    candidate_index = index
                    break

        if candidate_index is None:
            return 0
        if candidate_index > 0 and generated_day_items[candidate_index - 1].item_type == "transport":
            return candidate_index - 1
        return candidate_index

    def _select_generated_replacement_block(
        self,
        *,
        generated_day_items: list[ItineraryItem],
        target_item: ItineraryItem,
    ) -> list[ItineraryItem]:
        place_candidates = [item for item in generated_day_items if item.item_type == "place"]
        if not place_candidates:
            return []

        alternative_candidates = [
            item
            for item in place_candidates
            if self._normalize_place_name(item.name) != self._normalize_place_name(target_item.name)
        ]
        candidate_pool = alternative_candidates or place_candidates

        def replacement_sort_key(item: ItineraryItem) -> tuple[float, int]:
            return (
                abs(self._sortable_datetime_value(item.start_time) - self._sortable_datetime_value(target_item.start_time)),
                item.sequence or 9999,
            )

        chosen_item = min(candidate_pool, key=replacement_sort_key)
        chosen_index = generated_day_items.index(chosen_item)
        block_start = chosen_index - 1 if chosen_index > 0 and generated_day_items[chosen_index - 1].item_type == "transport" else chosen_index
        block_end = chosen_index + 1 if chosen_index + 1 < len(generated_day_items) and generated_day_items[chosen_index + 1].item_type == "transport" else chosen_index
        return list(generated_day_items[block_start : block_end + 1])

    def _resequence_itinerary_items(
        self,
        *,
        days: list[TripDay],
        items: list[ItineraryItem],
    ) -> list[ItineraryItem]:
        grouped = self._group_itinerary_items_by_day(items)
        resequenced: list[ItineraryItem] = []
        for day in sorted(days, key=lambda value: value.day_number):
            if day.id is None:
                continue
            for sequence, item in enumerate(grouped.get(day.id, []), start=1):
                item.sequence = sequence
                resequenced.append(item)
        return resequenced

    async def _ensure_trip_days(
        self,
        trip_id: int,
        start_date: date,
        end_date: date,
    ) -> list[TripDay]:
        return await self._sync_trip_days_to_range(trip_id, start_date, end_date)

    async def _sync_trip_days_to_range(
        self,
        trip_id: int,
        start_date: date,
        end_date: date,
    ) -> list[TripDay]:
        total_days = (end_date - start_date).days + 1
        if total_days <= 0:
            total_days = 1

        existing_days = await self.trip_repository.list_days_by_trip(trip_id)
        existing_by_number = {day.day_number: day for day in existing_days}

        for day_number in range(1, total_days + 1):
            target_date = start_date + timedelta(days=day_number - 1)
            existing = existing_by_number.get(day_number)
            if existing is None:
                await self.trip_repository.create_day(
                    TripDay(
                        id=None,
                        trip_id=trip_id,
                        day_number=day_number,
                        date=target_date,
                        lodging_note=None,
                    )
                )
                continue
            if existing.date != target_date:
                existing.date = target_date
                await self.trip_repository.update_day(existing)

        for existing in existing_days:
            if existing.day_number > total_days and existing.id is not None:
                await self.trip_repository.delete_day(existing.id)

        return await self.trip_repository.list_days_by_trip(trip_id)

    async def _collect_place_candidates(
        self,
        destination: str,
        preference: Optional[TripPreference],
        max_candidates: int,
        must_visit_places: Optional[list[str]] = None,
        destination_location: Optional[dict] = None,
        incident_type: Optional[str] = None,
        adjustment_policies: Optional[list[str]] = None,
    ) -> list[PlaceCandidate]:
        place_client = GooglePlacesClient()
        atmosphere_hint = preference.atmosphere.value if preference is not None else ""
        normalized_policies = set(_normalize_generation_text_items(adjustment_policies))
        queries = [
            f"{destination} 観光地",
            f"{destination} 人気スポット",
            f"{destination} レストラン",
            f"{destination} カフェ",
        ]
        if incident_type == "bad_weather" or "indoor_preferred" in normalized_policies:
            queries.extend(
                [
                    f"{destination} 屋内 おすすめ",
                    f"{destination} 美術館",
                    f"{destination} 水族館",
                    f"{destination} ショッピングモール",
                ]
            )
        if incident_type == "delay" or "shorter_travel" in normalized_policies:
            queries.extend([f"{destination} 駅近 観光", f"{destination} 徒歩圏内 おすすめ"])
        if incident_type == "fatigue" or "less_walking" in normalized_policies:
            queries.extend([f"{destination} 休憩 カフェ", f"{destination} 温泉 日帰り"])
        if "food_priority" in normalized_policies:
            queries.extend([f"{destination} ランチ 人気", f"{destination} ディナー おすすめ"])
        if "scenic_priority" in normalized_policies:
            queries.extend([f"{destination} 展望台", f"{destination} 景色 おすすめ"])
        if atmosphere_hint:
            queries.append(f"{destination} {atmosphere_hint} おすすめ")
        for must_visit_place in _normalize_generation_text_items(must_visit_places):
            queries.append(f"{destination} {must_visit_place}")

        merged: list[PlaceCandidate] = []
        seen: set[tuple[str, str]] = set()
        per_query = max(4, max_candidates // max(1, len(queries)))
        for query in queries:
            results = await place_client.search_text(query=query, max_results=per_query)
            for result in results:
                if not self._is_place_candidate_allowed_for_destination_context(
                    candidate=result,
                    destination=destination,
                    destination_location=destination_location,
                ):
                    continue
                key = (result.name, result.address or "")
                if key in seen:
                    continue
                seen.add(key)
                merged.append(result)
                if len(merged) >= max_candidates:
                    return self._prune_outlier_candidates(merged, max_candidates)
        if merged:
            return self._prune_outlier_candidates(merged, max_candidates)
        return [
            PlaceCandidate(
                name=f"{destination} 散策",
                address=destination,
                category="tourist_attraction",
            )
        ]

    def _prune_outlier_candidates(
        self,
        candidates: list[PlaceCandidate],
        max_candidates: int,
    ) -> list[PlaceCandidate]:
        with_coordinates = [item for item in candidates if item.latitude is not None and item.longitude is not None]
        if len(with_coordinates) < 4:
            return candidates[:max_candidates]

        center_lat = sum(item.latitude for item in with_coordinates if item.latitude is not None) / len(with_coordinates)
        center_lon = sum(item.longitude for item in with_coordinates if item.longitude is not None) / len(with_coordinates)

        filtered: list[PlaceCandidate] = []
        for item in candidates:
            if item.latitude is None or item.longitude is None:
                filtered.append(item)
                continue
            distance = self._estimate_distance_to_coordinates(
                item.latitude,
                item.longitude,
                center_lat,
                center_lon,
            )
            if distance <= 120_000:
                filtered.append(item)
        if not filtered:
            return candidates[:max_candidates]
        return filtered[:max_candidates]

    async def _generate_plan_payload(
        self,
        trip: Trip,
        preference: Optional[TripPreference],
        days: list[TripDay],
        place_candidates: list[PlaceCandidate],
        route_options: list[RouteOption],
        generation_input: Optional[dict] = None,
    ) -> dict:
        gemini_client = GeminiClient()
        prompt = self._build_gemini_prompt(
            trip=trip,
            preference=preference,
            days=days,
            place_candidates=place_candidates,
            route_options=route_options,
            generation_input=generation_input,
        )
        return await gemini_client.generate_json(prompt=prompt, temperature=0.2)

    def _build_gemini_prompt(
        self,
        trip: Trip,
        preference: Optional[TripPreference],
        days: list[TripDay],
        place_candidates: list[PlaceCandidate],
        route_options: list[RouteOption],
        generation_input: Optional[dict] = None,
    ) -> str:
        generation_input = generation_input or {}
        days_payload = [
            {"day_number": d.day_number, "date": d.date.isoformat() if d.date is not None else None} for d in days
        ]
        candidates_payload = [candidate.to_dict() for candidate in place_candidates]
        selected_transport_types = self._parse_selected_transport_types(
            preference.transport_type if preference is not None else None
        )
        route_options_payload = [
            self._normalize_route_option_dict(route_option.to_dict())
            for route_option in self._filter_route_options_by_preference(route_options, selected_transport_types)
        ]
        preference_payload = (
            {
                "atmosphere": preference.atmosphere.value,
                "companions": preference.companions,
                "budget": preference.budget,
                "transport_type": preference.transport_type,
            }
            if preference is not None
            else None
        )
        must_visit_places = _normalize_generation_text_items(generation_input.get("must_visit_places"))
        lodging_notes = _normalize_generation_text_items_by_day(generation_input.get("lodging_notes"))
        selected_companion_names = _normalize_generation_text_items(generation_input.get("selected_companion_names"))
        additional_request_comment = (generation_input.get("additional_request_comment") or "").strip() or None
        incident_type = (generation_input.get("incident_type") or "").strip() or None
        incident_note = (generation_input.get("incident_note") or "").strip() or None
        delay_minutes = generation_input.get("delay_minutes")
        adjustment_policies = _normalize_generation_text_items(generation_input.get("adjustment_policies"))
        return (
            "旅行日程を最適化してください。必ずJSONオブジェクトのみを返してください。\n"
            'フォーマット: {"days": [{"day_number": 1, "items": ['
            '{"item_type": "place", "name": "", "category": "", "latitude": 0, '
            '"longitude": 0, "start_time": "09:00", "end_time": "10:30", '
            '"estimated_cost": 0, "notes": ""}, '
            '{"item_type": "transport", "name": "徒歩で移動", "transport_mode": "WALK", '
            '"travel_minutes": 15, "distance_meters": 1200, "from_name": "A", "to_name": "B", '
            '"start_time": "10:30", "end_time": "10:45", "notes": "徒歩で移動 / 約15分 / 約1.2km"}'
            "]}]}\n"
            f"trip={json.dumps({'origin': trip.origin, 'destination': trip.destination}, ensure_ascii=False)}\n"
            f"days={json.dumps(days_payload, ensure_ascii=False)}\n"
            f"preference={json.dumps(preference_payload, ensure_ascii=False)}\n"
            f"recommended_categories={json.dumps(trip.recommendation_categories, ensure_ascii=False)}\n"
            f"selected_transport_types={json.dumps(selected_transport_types, ensure_ascii=False)}\n"
            f"must_visit_places={json.dumps(must_visit_places, ensure_ascii=False)}\n"
            f"lodging_notes_by_day={json.dumps(lodging_notes, ensure_ascii=False)}\n"
            f"selected_companion_names={json.dumps(selected_companion_names, ensure_ascii=False)}\n"
            f"additional_request_comment={json.dumps(additional_request_comment, ensure_ascii=False)}\n"
            f"incident_type={json.dumps(incident_type, ensure_ascii=False)}\n"
            f"incident_note={json.dumps(incident_note, ensure_ascii=False)}\n"
            f"delay_minutes={json.dumps(delay_minutes, ensure_ascii=False)}\n"
            f"adjustment_policies={json.dumps(adjustment_policies, ensure_ascii=False)}\n"
            f"candidates={json.dumps(candidates_payload, ensure_ascii=False)}\n"
            f"route_options={json.dumps(route_options_payload, ensure_ascii=False)}\n"
            "ルール:\n"
            "- day_number は必ず存在し、入力 days と一致させる\n"
            "- items は place と transport を時系列に並べる\n"
            "- place は各日2-5件\n"
            "- place 同士の間には transport を入れる\n"
            "- start_time/end_time は HH:MM\n"
            f"- place の主要活動時間は {self.ACTIVITY_START_TIME}-{self.ACTIVITY_END_TIME} を原則とする\n"
            "- 1日目の最初は必ず「出発地から最初の地点への移動」にする\n"
            "- 最終日の最後は必ず「最終地点から出発地への戻り移動」にする\n"
            "- candidatesにある名称を優先利用\n"
            "- recommended_categories にあるカテゴリは、可能な限り各カテゴリを少なくとも1回は含める\n"
            "- transport は selected_transport_types に対応するものを優先して使う\n"
            "- 徒歩は selected_transport_types に含まれていなくても使ってよい\n"
            "- 徒歩以外で、selected_transport_types に含まれない移動手段は絶対に使わない\n"
            "- budget は観光/食事/体験の目安であり、移動費（電車・バス・徒歩）は含めない\n"
            "- transport item の estimated_cost は 0 または null にする\n"
            "- transport は route_options にある候補を優先して使う\n"
            "- route_options が不足する場合も、徒歩以外で selected_transport_types に無い手段は使わない\n"
            "- must_visit_places がある場合は、実現可能な範囲で優先して組み込む\n"
            "- lodging_notes_by_day は day_number 順の配列（null は指定なし）として扱い、各日の夜の帰着や宿泊候補として尊重する\n"
            "- additional_request_comment に書かれた希望や制約を優先する\n"
            "- selected_companion_names は同行者コンテキストとして扱い、二人旅やグループ旅行らしい無理のないプランにする\n"
            "- incident_type, incident_note, delay_minutes, adjustment_policies がある場合は通常の希望より優先する\n"
            "- bad_weather または indoor_preferred のときは屋内スポットを優先する\n"
            "- delay または delay_minutes があるときは後半の予定を詰め込みすぎず、必要なら優先度の低いスポットを減らす\n"
            "- fatigue, less_walking, shorter_travel のときは徒歩負荷と移動回数を減らす\n"
            "- food_priority のときは食事スポットを優先する\n"
            "- scenic_priority のときは景色系スポットを優先する\n"
            "- 公共交通（電車・バス）を優先し、成立しない場合のみ徒歩や代替手段を使う\n"
            "- 長距離移動直後に予定を詰め込みすぎない現実的な行程にする\n"
        )

    def _apply_incident_plan_adjustments(
        self,
        normalized_plan: dict,
        generation_input: Optional[dict] = None,
    ) -> dict:
        generation_input = generation_input or {}
        incident_type = (generation_input.get("incident_type") or "").strip()
        delay_minutes = generation_input.get("delay_minutes")
        policies = set(_normalize_generation_text_items(generation_input.get("adjustment_policies")))

        max_places_per_day: Optional[int] = None
        if isinstance(delay_minutes, int) and delay_minutes >= 90:
            max_places_per_day = 2
        elif isinstance(delay_minutes, int) and delay_minutes >= 30:
            max_places_per_day = 3
        elif incident_type == "fatigue" or {"less_walking", "shorter_travel"} & policies:
            max_places_per_day = 3

        if max_places_per_day is None:
            return normalized_plan

        adjusted_days: list[dict] = []
        for day_payload in normalized_plan.get("days", []):
            day_copy = dict(day_payload)
            day_copy["items"] = self._limit_place_items_for_adjustment(
                day_payload.get("items", []),
                max_places_per_day=max_places_per_day,
            )
            adjusted_days.append(day_copy)

        updated_plan = dict(normalized_plan)
        updated_plan["days"] = adjusted_days
        return updated_plan

    def _limit_place_items_for_adjustment(
        self,
        items: list[dict],
        max_places_per_day: int,
    ) -> list[dict]:
        trimmed: list[dict] = []
        place_count = 0
        for item in items:
            item_type = (item.get("item_type") or "").strip().lower()
            if item_type == "place":
                if place_count >= max_places_per_day:
                    continue
                place_count += 1
                trimmed.append(item)
                continue

            if item_type == "transport":
                if place_count >= max_places_per_day:
                    continue
                trimmed.append(item)
                continue

            trimmed.append(item)
        return trimmed

    def _validate_location_like_text(self, value: str, field_label: str) -> None:
        text = (value or "").strip()
        if not text:
            raise ValueError(f"{field_label}を入力してください。")
        lower_text = text.lower()
        if lower_text in self._SUSPECT_LOCATION_WORDS:
            raise ValueError(f"{field_label}の入力を確認してください。")
        if text.isdigit():
            raise ValueError(f"{field_label}の入力を確認してください。")
        if len(set(lower_text)) == 1 and len(lower_text) >= 3:
            raise ValueError(f"{field_label}の入力を確認してください。")
        if len(text) < 2 and not any(marker in text for marker in ("駅", "空港", "市", "区", "町", "村", "県", "都", "府")):
            raise ValueError(f"{field_label}の入力を確認してください。")

    def _parse_selected_transport_types(self, raw_value: Optional[str]) -> list[str]:
        if raw_value is None:
            return []

        # Normalize case and keep only supported transport types.
        # If all tokens are invalid, return an empty list to indicate
        # "no filtering" to _filter_route_options_by_preference.
        allowed_types = {"train", "bus", "walk"}
        normalized_tokens: list[str] = []
        for item in raw_value.split(","):
            token = item.strip().lower()
            if not token:
                continue
            if token in allowed_types:
                normalized_tokens.append(token)

        return normalized_tokens if normalized_tokens else []

    def _filter_route_options_by_preference(
        self,
        route_options: list[RouteOption],
        selected_transport_types: list[str],
    ) -> list[RouteOption]:
        if not selected_transport_types:
            return route_options

        allow_walk = True
        allow_train = "train" in selected_transport_types
        allow_bus = "bus" in selected_transport_types

        filtered: list[RouteOption] = []
        for option in route_options:
            normalized = self._normalize_route_option_dict(option.to_dict())
            transport_mode = normalized.get("transport_mode")
            if transport_mode == "WALK" and allow_walk:
                filtered.append(option)
            elif transport_mode == "TRAIN" and allow_train:
                filtered.append(option)
            elif transport_mode == "BUS" and allow_bus:
                filtered.append(option)
        return filtered

    def _normalize_route_option_dict(self, option: dict) -> dict:
        """
        Normalize a RouteOption dictionary so that it always exposes a `transport_mode`
        field with one of WALK/TRAIN/BUS, matching the prompt specification.
        """
        normalized = dict(option) if option is not None else {}
        travel_mode = normalized.get("travel_mode")
        transit_subtype = normalized.get("transit_subtype")

        if travel_mode == "WALK":
            transport_mode = "WALK"
        elif travel_mode == "TRANSIT":
            subtype = (transit_subtype or "").upper()
            if subtype == "BUS":
                transport_mode = "BUS"
            else:
                # Treat all non-bus transit (e.g. trains, subways) as TRAIN.
                transport_mode = "TRAIN"
        else:
            # Fallback when no explicit mode is provided.
            transport_mode = "WALK"

        normalized["transport_mode"] = transport_mode
        return normalized

    async def _collect_route_options(
        self,
        trip: Trip,
        days: list[TripDay],
        place_candidates: list[PlaceCandidate],
    ) -> list[RouteOption]:
        candidates = [
            candidate
            for candidate in place_candidates
            if isinstance(candidate.name, str) and candidate.name.strip()
        ]
        candidates = candidates[: self.MAX_ROUTE_CANDIDATES]
        if len(candidates) < 2:
            return []

        departure_date = days[0].date if days and days[0].date is not None else trip.start_date
        local_departure_time = datetime.combine(departure_date, time(9, 0)).replace(tzinfo=ZoneInfo("Asia/Tokyo"))
        departure_time = local_departure_time.astimezone(timezone.utc)
        route_client = RoutesClient()

        pair_candidates: list[tuple[str, str]] = []
        seen_pairs: set[tuple[str, str]] = set()
        for origin in candidates:
            nearest_destinations = [
                destination for destination in candidates if destination.name != origin.name
            ][: self.MAX_NEAREST_DESTINATIONS_PER_CANDIDATE]
            for destination in nearest_destinations:
                key = (
                    origin.name,
                    destination.name,
                )
                if key in seen_pairs:
                    continue
                seen_pairs.add(key)
                pair_candidates.append((origin.name, destination.name))

        results = await asyncio.gather(
            *[
                route_client.compute_route_options(
                    origin=origin, destination=destination, departure_time=departure_time
                )
                for origin, destination in pair_candidates
            ],
            return_exceptions=True,
        )
        route_options: list[RouteOption] = []
        for result in results:
            if isinstance(result, list):
                route_options.extend(result)
        return route_options

    def _normalize_plan_payload(
        self,
        plan_payload: dict,
        days: list[TripDay],
        fallback_candidates: list[PlaceCandidate],
        route_options: list[RouteOption],
        destination: str,
        destination_location: Optional[dict] = None,
    ) -> dict[int, list[dict]]:
        by_day: dict[int, list[dict]] = {day.day_number: [] for day in days}
        candidate_map = {candidate.name: candidate for candidate in fallback_candidates}
        candidate_list = list(candidate_map.values())
        days_payload = plan_payload.get("days", [])
        if isinstance(days_payload, list):
            for day_node in days_payload:
                if not isinstance(day_node, dict):
                    continue
                day_number = day_node.get("day_number")
                if not isinstance(day_number, int) or day_number not in by_day:
                    continue
                items = day_node.get("items", [])
                if not isinstance(items, list):
                    continue
                for item in items:
                    if (
                        isinstance(item, dict)
                        and item.get("name")
                        and self._is_place_item_allowed_for_destination(
                            item=item,
                            destination=destination,
                            candidate_map=candidate_map,
                            destination_location=destination_location,
                        )
                    ):
                        matched_candidate = self._find_matching_place_candidate_for_payload(
                            item=item,
                            candidates=candidate_list,
                        )
                        by_day[day_number].append(
                            self._enrich_place_item_payload(
                                item=item,
                                candidate=matched_candidate,
                            )
                        )

        if any(by_day.values()):
            return {
                day_number: self._inject_transport_items(items, route_options) for day_number, items in by_day.items()
            }

        # Fallback: evenly assign fetched candidates.
        if not fallback_candidates:
            return by_day
        day_numbers = [day.day_number for day in days]
        for idx, candidate in enumerate(fallback_candidates):
            day_number = day_numbers[idx % len(day_numbers)]
            seq = len(by_day[day_number]) + 1
            start_hour = 9 + (seq - 1) * 2
            by_day[day_number].append(
                {
                    "item_type": "place",
                    "name": candidate.name,
                    "category": candidate.category,
                    "latitude": candidate.latitude,
                    "longitude": candidate.longitude,
                    "start_time": f"{start_hour:02d}:00",
                    "end_time": f"{min(start_hour + 1, 23):02d}:30",
                    "estimated_cost": None,
                    "notes": candidate.address,
                }
            )
        return {day_number: self._inject_transport_items(items, route_options) for day_number, items in by_day.items()}

    def _is_place_item_allowed_for_destination(
        self,
        item: dict,
        destination: str,
        candidate_map: dict[str, PlaceCandidate],
        destination_location: Optional[dict] = None,
    ) -> bool:
        if self._is_transport_item_payload(item):
            return True

        name = str(item.get("name") or "")
        notes = str(item.get("notes") or "")
        joined = f"{name} {notes}".strip()
        candidate = self._find_matching_place_candidate_for_payload(
            item=item,
            candidates=list(candidate_map.values()),
        )
        candidate_address = candidate.address if candidate is not None else None

        if self._contains_non_matching_prefecture(
            text=joined,
            allowed_prefectures=self._extract_destination_prefecture_tokens(destination),
        ):
            return False
        if candidate_address and self._contains_non_matching_prefecture(
            text=candidate_address,
            allowed_prefectures=self._extract_destination_prefecture_tokens(destination),
        ):
            return False

        coordinates = self._resolve_item_or_candidate_coordinates(item=item, candidate=candidate)
        if coordinates is not None and self._is_far_from_destination(
            latitude=coordinates[0],
            longitude=coordinates[1],
            destination=destination,
            destination_location=destination_location,
        ):
            return False

        if not self._is_okinawa_destination(destination):
            return True

        if self._contains_okinawa_keyword(joined):
            return True
        if candidate_address and self._contains_okinawa_keyword(candidate_address):
            return True

        latitude = item.get("latitude")
        longitude = item.get("longitude")
        if isinstance(latitude, (int, float)) and isinstance(longitude, (int, float)):
            return self._is_within_okinawa_bounds(float(latitude), float(longitude))
        if candidate and candidate.latitude is not None and candidate.longitude is not None:
            return self._is_within_okinawa_bounds(candidate.latitude, candidate.longitude)

        return True

    def _enrich_place_item_payload(
        self,
        *,
        item: dict,
        candidate: Optional[PlaceCandidate],
    ) -> dict:
        if self._is_transport_item_payload(item):
            return item

        enriched = dict(item)
        if candidate is None:
            return enriched

        if not enriched.get("category") and candidate.category:
            enriched["category"] = candidate.category
        if enriched.get("latitude") is None and candidate.latitude is not None:
            enriched["latitude"] = candidate.latitude
        if enriched.get("longitude") is None and candidate.longitude is not None:
            enriched["longitude"] = candidate.longitude
        if candidate.address and not enriched.get("notes"):
            enriched["notes"] = candidate.address
        return enriched

    def _find_matching_place_candidate_for_payload(
        self,
        *,
        item: dict,
        candidates: list[PlaceCandidate],
    ) -> Optional[PlaceCandidate]:
        name = str(item.get("name") or "").strip()
        if not name or not candidates:
            return None

        normalized_item_name = self._normalize_place_name(name)
        exact_matches = [
            candidate
            for candidate in candidates
            if self._normalize_place_name(candidate.name) == normalized_item_name
        ]
        if exact_matches:
            return self._pick_best_place_candidate_from_payload(item=item, candidates=exact_matches)

        partial_matches = [
            candidate
            for candidate in candidates
            if normalized_item_name in self._normalize_place_name(candidate.name)
            or self._normalize_place_name(candidate.name) in normalized_item_name
        ]
        if partial_matches:
            return self._pick_best_place_candidate_from_payload(item=item, candidates=partial_matches)

        return None

    def _pick_best_place_candidate_from_payload(
        self,
        *,
        item: dict,
        candidates: list[PlaceCandidate],
    ) -> PlaceCandidate:
        latitude = item.get("latitude")
        longitude = item.get("longitude")
        if not isinstance(latitude, (int, float)) or not isinstance(longitude, (int, float)):
            return candidates[0]

        return min(
            candidates,
            key=lambda candidate: self._estimate_distance_to_coordinates(
                float(latitude),
                float(longitude),
                candidate.latitude,
                candidate.longitude,
            ),
        )

    def _is_place_candidate_allowed_for_destination_context(
        self,
        candidate: PlaceCandidate,
        destination: str,
        destination_location: Optional[dict] = None,
    ) -> bool:
        joined = " ".join(part for part in (candidate.name, candidate.address) if part).strip()
        if self._contains_non_matching_prefecture(
            text=joined,
            allowed_prefectures=self._extract_destination_prefecture_tokens(destination),
        ):
            return False
        if candidate.latitude is not None and candidate.longitude is not None and self._is_far_from_destination(
            latitude=candidate.latitude,
            longitude=candidate.longitude,
            destination=destination,
            destination_location=destination_location,
        ):
            return False
        return True

    @staticmethod
    def _is_okinawa_destination(destination: str) -> bool:
        text = (destination or "").strip()
        return "沖縄" in text or "那覇" in text

    @staticmethod
    def _contains_okinawa_keyword(text: str) -> bool:
        return any(keyword in text for keyword in ("沖縄", "那覇", "恩納", "石垣", "宮古", "宜野湾", "名護", "浦添"))

    def _extract_destination_prefecture_tokens(self, destination: str) -> set[str]:
        text = (destination or "").strip()
        if not text:
            return set()

        matched = {token for token in self.PREFECTURE_TOKENS if token in text}
        if "沖縄" in text or "那覇" in text:
            matched.add("沖縄県")
        return matched

    def _contains_non_matching_prefecture(self, text: str, allowed_prefectures: set[str]) -> bool:
        if not text or not allowed_prefectures:
            return False
        return any(token in text for token in self.PREFECTURE_TOKENS if token not in allowed_prefectures)

    def _resolve_item_or_candidate_coordinates(
        self,
        *,
        item: dict,
        candidate: Optional[PlaceCandidate],
    ) -> Optional[tuple[float, float]]:
        latitude = item.get("latitude")
        longitude = item.get("longitude")
        if isinstance(latitude, (int, float)) and isinstance(longitude, (int, float)):
            return float(latitude), float(longitude)
        if candidate is not None and candidate.latitude is not None and candidate.longitude is not None:
            return candidate.latitude, candidate.longitude
        return None

    def _is_destination_scope_wide(self, destination: str) -> bool:
        text = (destination or "").strip()
        if not text:
            return False
        return (
            "北海道" in text
            or "沖縄" in text
            or any(token in text for token in self.PREFECTURE_TOKENS)
            or any(marker in text for marker in ("都", "道", "府", "県"))
        )

    def _destination_radius_meters(self, destination: str) -> int:
        if self._is_destination_scope_wide(destination):
            return self.WIDE_DESTINATION_RADIUS_METERS
        return self.LOCAL_DESTINATION_RADIUS_METERS

    def _is_far_from_destination(
        self,
        *,
        latitude: float,
        longitude: float,
        destination: str,
        destination_location: Optional[dict] = None,
    ) -> bool:
        if not isinstance(destination_location, dict):
            return False
        destination_latitude = destination_location.get("latitude")
        destination_longitude = destination_location.get("longitude")
        if not isinstance(destination_latitude, (int, float)) or not isinstance(destination_longitude, (int, float)):
            return False
        distance = self._estimate_distance_to_coordinates(
            latitude,
            longitude,
            float(destination_latitude),
            float(destination_longitude),
        )
        return distance > self._destination_radius_meters(destination)

    @staticmethod
    def _is_within_okinawa_bounds(latitude: float, longitude: float) -> bool:
        return 24.0 <= latitude <= 28.8 and 122.0 <= longitude <= 131.5

    def _build_generated_itinerary_items(
        self,
        days: list[TripDay],
        normalized_plan: dict[int, list[dict]],
    ) -> list[ItineraryItem]:
        items_to_insert: list[ItineraryItem] = []
        for day in sorted(days, key=lambda x: x.day_number):
            if day.id is None:
                continue
            items = normalized_plan.get(day.day_number, [])
            for sequence, raw in enumerate(items, start=1):
                generated_item = ItineraryItem(
                    id=None,
                    trip_day_id=day.id,
                    name=str(raw.get("name", "")),
                    sequence=sequence,
                    item_type=str(raw.get("item_type", "place")),
                    category=raw.get("category"),
                    transport_mode=raw.get("transport_mode"),
                    travel_minutes=self._to_optional_int(raw.get("travel_minutes")),
                    distance_meters=self._to_optional_int(raw.get("distance_meters")),
                    from_name=raw.get("from_name"),
                    to_name=raw.get("to_name"),
                    latitude=raw.get("latitude"),
                    longitude=raw.get("longitude"),
                    start_time=self._build_datetime(day.date, raw.get("start_time")),
                    end_time=self._build_datetime(day.date, raw.get("end_time")),
                    estimated_cost=(
                        None
                        if str(raw.get("item_type", "place")) == "transport"
                        else self._to_optional_int(raw.get("estimated_cost"))
                    ),
                    notes=raw.get("notes"),
                    line_name=raw.get("line_name"),
                    vehicle_type=raw.get("vehicle_type"),
                    departure_stop_name=raw.get("departure_stop_name"),
                    arrival_stop_name=raw.get("arrival_stop_name"),
                )
                if not generated_item.name:
                    continue
                items_to_insert.append(generated_item)
        return items_to_insert

    async def _update_trip_cover_image_from_itinerary(
        self,
        trip: Trip,
        itinerary_items: list[ItineraryItem],
        fallback_candidates: list[PlaceCandidate],
    ) -> bool:
        try:
            cover_image_url = await self._resolve_cover_image_url_for_trip(
                trip=trip,
                itinerary_items=itinerary_items,
                fallback_candidates=fallback_candidates,
            )
        except Exception:  # noqa: BLE001
            return False

        if not cover_image_url or cover_image_url == trip.cover_image_url:
            return False

        trip.cover_image_url = cover_image_url
        updated_trip = await self.trip_repository.update_trip(trip)
        return updated_trip is not None and updated_trip.cover_image_url == cover_image_url

    async def _resolve_cover_image_url_for_trip(
        self,
        trip: Trip,
        itinerary_items: list[ItineraryItem],
        fallback_candidates: list[PlaceCandidate],
    ) -> Optional[str]:
        representative_item = self._select_representative_place_item(itinerary_items)
        if representative_item is None:
            return None

        place_client = GooglePlacesClient()

        candidate = self._find_matching_place_candidate(representative_item, fallback_candidates)
        if candidate is None or not candidate.photo_name:
            query = f"{representative_item.name} {trip.destination}".strip()
            search_results = await place_client.search_text(query=query, max_results=5)
            candidate = self._find_matching_place_candidate(representative_item, search_results)

        if candidate is None or not candidate.photo_name:
            return None

        return await place_client.get_photo_media(candidate.photo_name)

    def _select_representative_place_item(
        self,
        itinerary_items: list[ItineraryItem],
    ) -> Optional[ItineraryItem]:
        place_items = [item for item in itinerary_items if item.item_type == "place" and item.name]
        if not place_items:
            return None

        return max(
            place_items,
            key=lambda item: (
                self._stay_duration_minutes(item),
                -self._sortable_datetime_value(item.start_time),
                -(item.sequence or 0),
            ),
        )

    def _find_matching_place_candidate(
        self,
        item: ItineraryItem,
        candidates: list[PlaceCandidate],
    ) -> Optional[PlaceCandidate]:
        if not candidates:
            return None

        normalized_item_name = self._normalize_place_name(item.name)
        photo_candidates = [candidate for candidate in candidates if candidate.photo_name]
        search_pool = photo_candidates or candidates

        exact_matches = [
            candidate
            for candidate in search_pool
            if self._normalize_place_name(candidate.name) == normalized_item_name
        ]
        if exact_matches:
            return self._pick_best_place_candidate(item, exact_matches)

        partial_matches = [
            candidate
            for candidate in search_pool
            if normalized_item_name in self._normalize_place_name(candidate.name)
            or self._normalize_place_name(candidate.name) in normalized_item_name
        ]
        if partial_matches:
            return self._pick_best_place_candidate(item, partial_matches)

        return None

    def _pick_best_place_candidate(
        self,
        item: ItineraryItem,
        candidates: list[PlaceCandidate],
    ) -> PlaceCandidate:
        if item.latitude is None or item.longitude is None:
            return candidates[0]

        return min(
            candidates,
            key=lambda candidate: self._estimate_distance_to_coordinates(
                item.latitude,
                item.longitude,
                candidate.latitude,
                candidate.longitude,
            ),
        )

    def _stay_duration_minutes(self, item: ItineraryItem) -> int:
        if item.start_time is None or item.end_time is None:
            return 0
        delta_minutes = int((item.end_time - item.start_time).total_seconds() // 60)
        return max(delta_minutes, 0)

    def _sortable_datetime_value(self, value: Optional[datetime]) -> float:
        if value is None:
            return float("inf")
        return value.timestamp()

    def _normalize_place_name(self, value: str) -> str:
        return "".join(value.lower().split())

    def _estimate_distance_to_coordinates(
        self,
        origin_latitude: Optional[float],
        origin_longitude: Optional[float],
        destination_latitude: Optional[float],
        destination_longitude: Optional[float],
    ) -> float:
        if (
            origin_latitude is None
            or origin_longitude is None
            or destination_latitude is None
            or destination_longitude is None
        ):
            return float("inf")
        lat_scale = 111_000
        lon_scale = 91_000
        lat_delta = (origin_latitude - destination_latitude) * lat_scale
        lon_delta = (origin_longitude - destination_longitude) * lon_scale
        return (lat_delta**2 + lon_delta**2) ** 0.5

    def _build_datetime(self, day_date: Optional[date], value: Optional[str]) -> Optional[datetime]:
        if day_date is None or value is None:
            return None
        if not isinstance(value, str):
            return None
        try:
            parsed = datetime.strptime(value, "%H:%M").time()
        except ValueError:
            return None
        return datetime.combine(day_date, time(parsed.hour, parsed.minute))

    def _to_optional_int(self, value: object) -> Optional[int]:
        if value is None:
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    def _estimate_distance_meters(self, origin: PlaceCandidate, destination: PlaceCandidate) -> float:
        if (
            origin.latitude is None
            or origin.longitude is None
            or destination.latitude is None
            or destination.longitude is None
        ):
            return float("inf")
        lat_scale = 111_000
        lon_scale = 91_000
        lat_delta = (origin.latitude - destination.latitude) * lat_scale
        lon_delta = (origin.longitude - destination.longitude) * lon_scale
        return (lat_delta**2 + lon_delta**2) ** 0.5

    def _inject_transport_items(
        self,
        items: list[dict],
        route_options: list[RouteOption],
    ) -> list[dict]:
        if not items:
            return items
        if any(self._is_transport_item_payload(item) for item in items):
            return items

        route_map: dict[tuple[str, str], list[RouteOption]] = {}
        for option in route_options:
            route_map.setdefault((option.from_name, option.to_name), []).append(option)

        injected: list[dict] = []
        for index, item in enumerate(items):
            item.setdefault("item_type", "place")
            injected.append(item)
            if index == len(items) - 1:
                continue
            next_item = items[index + 1]
            if self._is_transport_item_payload(item) or self._is_transport_item_payload(next_item):
                continue
            current_name = item.get("name")
            next_name = next_item.get("name")
            if not current_name or not next_name:
                continue
            option = self._pick_best_route_option(route_map.get((str(current_name), str(next_name)), []))
            if option is not None:
                injected.append(
                    self._route_option_to_item_payload(option, item.get("end_time"), next_item.get("start_time"))
                )
                continue
            injected.append(
                self._build_fallback_transport_item_payload(
                    from_name=str(current_name),
                    to_name=str(next_name),
                    previous_end_time=item.get("end_time"),
                    next_start_time=next_item.get("start_time"),
                )
            )
        return injected

    def _pick_best_route_option(self, options: list[RouteOption]) -> Optional[RouteOption]:
        if not options:
            return None

        def sort_key(option: RouteOption) -> tuple[int, int]:
            if option.travel_mode == "WALK" and (option.distance_meters or 0) <= 1500:
                priority = 0
            elif option.transit_subtype == "TRAIN":
                priority = 1
            elif option.transit_subtype == "BUS":
                priority = 2
            else:
                priority = 3
            return priority, option.duration_minutes or 9999

        return sorted(options, key=sort_key)[0]

    def _route_option_to_item_payload(
        self,
        option: RouteOption,
        previous_end_time: Optional[str],
        next_start_time: Optional[str],
    ) -> dict:
        scheduled_start_time = self._to_hhmm(option.departure_time)
        scheduled_end_time = self._to_hhmm(option.arrival_time)
        if scheduled_start_time and scheduled_end_time:
            start_time, end_time = scheduled_start_time, scheduled_end_time
        else:
            start_time, end_time = self._build_transport_time_window(
                previous_end_time=previous_end_time,
                next_start_time=next_start_time,
                travel_minutes=option.duration_minutes,
            )
        mode_label = "徒歩" if option.travel_mode == "WALK" else "バス" if option.transit_subtype == "BUS" else "電車"
        return {
            "item_type": "transport",
            "name": f"{mode_label}で移動",
            "category": "transport",
            "transport_mode": option.travel_mode
            if option.travel_mode == "WALK"
            else option.transit_subtype or "TRAIN",
            "travel_minutes": option.duration_minutes,
            "distance_meters": option.distance_meters,
            "from_name": option.from_name,
            "to_name": option.to_name,
            "start_time": start_time,
            "end_time": end_time,
            "notes": self._build_transport_notes(option),
            "line_name": option.line_name,
            "vehicle_type": option.vehicle_type,
            "departure_stop_name": option.from_name if option.transit_subtype else None,
            "arrival_stop_name": option.to_name if option.transit_subtype else None,
        }

    def _build_fallback_transport_item_payload(
        self,
        *,
        from_name: str,
        to_name: str,
        previous_end_time: Optional[str],
        next_start_time: Optional[str],
        diagnostics: Optional[dict] = None,
    ) -> dict:
        travel_minutes = self._infer_fallback_travel_minutes(previous_end_time, next_start_time)
        start_time, end_time = self._build_transport_time_window(
            previous_end_time=previous_end_time,
            next_start_time=next_start_time,
            travel_minutes=travel_minutes,
        )
        summary = f"公共交通機関が取得できませんでした。{from_name} → {to_name}"
        diagnostics_status = str((diagnostics or {}).get("last_error_status") or "").strip()
        if diagnostics_status:
            summary = f"{summary} ({diagnostics_status})"
        return {
            "item_type": "transport",
            "name": "移動",
            "category": "transport",
            "transport_mode": None,
            "travel_minutes": travel_minutes,
            "distance_meters": None,
            "from_name": from_name,
            "to_name": to_name,
            "start_time": start_time,
            "end_time": end_time,
            "notes": summary,
            "line_name": None,
            "vehicle_type": None,
            "departure_stop_name": None,
            "arrival_stop_name": None,
        }

    def _infer_fallback_travel_minutes(
        self,
        previous_end_time: Optional[str],
        next_start_time: Optional[str],
    ) -> int:
        if previous_end_time and next_start_time:
            try:
                start = datetime.strptime(previous_end_time, "%H:%M")
                end = datetime.strptime(next_start_time, "%H:%M")
                delta_minutes = int((end - start).total_seconds() // 60)
                if delta_minutes > 0:
                    return delta_minutes
            except ValueError:
                pass
        return 30

    def _build_transport_time_window(
        self,
        previous_end_time: Optional[str],
        next_start_time: Optional[str],
        travel_minutes: Optional[int],
    ) -> tuple[Optional[str], Optional[str]]:
        if travel_minutes is None:
            return previous_end_time, next_start_time
        if previous_end_time:
            start = previous_end_time
            end = self._shift_hhmm(previous_end_time, travel_minutes)
            return start, end
        if next_start_time:
            start = self._shift_hhmm(next_start_time, -travel_minutes)
            return start, next_start_time
        return None, None

    def _build_transport_notes(self, option: RouteOption) -> Optional[str]:
        parts: list[str] = []
        if option.summary:
            parts.append(option.summary)
        if option.line_name:
            parts.append(f"路線: {option.line_name}")
        departure = self._to_hhmm(option.departure_time)
        arrival = self._to_hhmm(option.arrival_time)
        if departure and arrival:
            parts.append(f"予定 {departure}発 - {arrival}着")
        elif departure:
            parts.append(f"予定 {departure}発")
        elif arrival:
            parts.append(f"予定 {arrival}着")
        return " / ".join(parts) if parts else None

    async def _rebuild_transport_items_from_routes(
        self,
        trip: Trip,
        days: list[TripDay],
        normalized_plan: dict[int, list[dict]],
        place_candidates: list[PlaceCandidate],
        origin_location: Optional[dict] = None,
        destination_location: Optional[dict] = None,
    ) -> tuple[dict[int, list[dict]], dict[str, int]]:
        candidate_map = {candidate.name: candidate for candidate in place_candidates}
        rebuilt: dict[int, list[dict]] = {}
        route_diagnostics = {
            "transit_attempted_pairs": 0,
            "transit_succeeded_pairs": 0,
            "transit_empty_pairs": 0,
            "transit_timeout_pairs": 0,
            "transit_exception_pairs": 0,
            "transit_fallback_info_pairs": 0,
            "walk_fallback_pairs": 0,
            "drive_fallback_pairs": 0,
        }
        route_client = RoutesClient()
        sorted_days = sorted(days, key=lambda day: day.day_number)
        first_day_number = sorted_days[0].day_number if sorted_days else None
        last_day_number = sorted_days[-1].day_number if sorted_days else None

        for day in days:
            items = normalized_plan.get(day.day_number, [])
            place_items = [item for item in items if not self._is_transport_item_payload(item)]
            if len(place_items) < 2:
                rebuilt[day.day_number] = place_items
                continue

            expanded: list[dict] = []
            if (
                day.day_number == first_day_number
                and origin_location
                and place_items
            ):
                first_item = place_items[0]
                destination_name = first_item.get("name")
                if isinstance(destination_name, str) and destination_name.strip():
                    origin_candidate = self._place_candidate_from_lat_lng(name=trip.origin, coordinates=origin_location)
                    destination_candidate = self._place_candidate_from_item(first_item, candidate_map)
                    origin_for_routing = self._build_routing_location_input(origin_candidate) or trip.origin
                    destination_for_routing = self._build_routing_location_input(destination_candidate) or destination_name

                    departure_time = self._resolve_route_departure_datetime(
                        trip_date=day.date or trip.start_date,
                        previous_end_time=None,
                    )
                    route_steps, diagnostics = await route_client.compute_route_steps_with_diagnostics(
                        origin=origin_for_routing,
                        destination=destination_for_routing,
                        departure_time=departure_time,
                    )
                    for key in route_diagnostics:
                        route_diagnostics[key] += diagnostics.get(key, 0)
                    if route_steps:
                        expanded.extend(
                            self._route_steps_to_item_payloads(
                                route_steps,
                                previous_end_time=None,
                                next_start_time=first_item.get("start_time"),
                                origin_name=trip.origin,
                                destination_name=destination_name,
                            )
                        )
                    else:
                        expanded.append(
                            self._build_fallback_transport_item_payload(
                                from_name=trip.origin,
                                to_name=destination_name,
                                previous_end_time=None,
                                next_start_time=first_item.get("start_time"),
                                diagnostics=diagnostics,
                            )
                        )

            for index, item in enumerate(place_items):
                expanded.append(item)
                if index == len(place_items) - 1:
                    continue

                next_item = place_items[index + 1]
                origin_name = item.get("name")
                destination_name = next_item.get("name")
                if (
                    not isinstance(origin_name, str)
                    or not origin_name.strip()
                    or not isinstance(destination_name, str)
                    or not destination_name.strip()
                ):
                    expanded.append(
                        self._build_fallback_transport_item_payload(
                            from_name=str(item.get("name")),
                            to_name=str(next_item.get("name")),
                            previous_end_time=item.get("end_time"),
                            next_start_time=next_item.get("start_time"),
                            diagnostics=None,
                        )
                    )
                    continue

                origin_candidate = self._place_candidate_from_item(item, candidate_map)
                destination_candidate = self._place_candidate_from_item(next_item, candidate_map)
                origin_for_routing = self._build_routing_location_input(origin_candidate) or origin_name
                destination_for_routing = self._build_routing_location_input(destination_candidate) or destination_name
                departure_time = self._resolve_route_departure_datetime(
                    trip_date=day.date or trip.start_date,
                    previous_end_time=item.get("end_time"),
                )
                route_steps, diagnostics = await route_client.compute_route_steps_with_diagnostics(
                    origin=origin_for_routing,
                    destination=destination_for_routing,
                    departure_time=departure_time,
                )
                for key in route_diagnostics:
                    route_diagnostics[key] += diagnostics.get(key, 0)
                if route_steps:
                    logger.info(
                        "TripService route steps found: trip_id=%s day=%s from=%s to=%s steps=%s lines=%s",
                        trip.id,
                        day.day_number,
                        item.get("name"),
                        next_item.get("name"),
                        len(route_steps),
                        [step.line_name for step in route_steps if step.line_name],
                    )
                    expanded.extend(
                        self._route_steps_to_item_payloads(
                            route_steps,
                            previous_end_time=item.get("end_time"),
                            next_start_time=next_item.get("start_time"),
                            origin_name=origin_name,
                            destination_name=destination_name,
                        )
                    )
                else:
                    logger.warning(
                        "TripService route steps missing, using fallback transport: trip_id=%s day=%s from=%s to=%s",
                        trip.id,
                        day.day_number,
                        item.get("name"),
                        next_item.get("name"),
                    )
                    expanded.append(
                        self._build_fallback_transport_item_payload(
                            from_name=str(item.get("name")),
                            to_name=str(next_item.get("name")),
                            previous_end_time=item.get("end_time"),
                            next_start_time=next_item.get("start_time"),
                            diagnostics=diagnostics,
                        )
                    )
            if (
                day.day_number == last_day_number
                and origin_location
                and place_items
            ):
                last_item = place_items[-1]
                origin_name = last_item.get("name")
                if isinstance(origin_name, str) and origin_name.strip():
                    origin_candidate = self._place_candidate_from_item(last_item, candidate_map)
                    destination_candidate = self._place_candidate_from_lat_lng(name=trip.origin, coordinates=origin_location)
                    origin_for_routing = self._build_routing_location_input(origin_candidate) or origin_name
                    destination_for_routing = self._build_routing_location_input(destination_candidate) or trip.origin
                    departure_time = self._resolve_route_departure_datetime(
                        trip_date=day.date or trip.start_date,
                        previous_end_time=last_item.get("end_time"),
                    )
                    route_steps, diagnostics = await route_client.compute_route_steps_with_diagnostics(
                        origin=origin_for_routing,
                        destination=destination_for_routing,
                        departure_time=departure_time,
                    )
                    for key in route_diagnostics:
                        route_diagnostics[key] += diagnostics.get(key, 0)
                    if route_steps:
                        expanded.extend(
                            self._route_steps_to_item_payloads(
                                route_steps,
                                previous_end_time=last_item.get("end_time"),
                                next_start_time=None,
                                origin_name=origin_name,
                                destination_name=trip.origin,
                            )
                        )
                    else:
                        expanded.append(
                            self._build_fallback_transport_item_payload(
                                from_name=origin_name,
                                to_name=trip.origin,
                                previous_end_time=last_item.get("end_time"),
                                next_start_time=None,
                                diagnostics=diagnostics,
                            )
                        )
            rebuilt[day.day_number] = expanded
        return rebuilt, route_diagnostics

    def _build_routing_location_input(
        self,
        candidate: Optional[PlaceCandidate],
    ) -> Optional[str]:
        if candidate is None:
            return None
        if isinstance(candidate.latitude, (int, float)) and isinstance(candidate.longitude, (int, float)):
            return f"{float(candidate.latitude)},{float(candidate.longitude)}"
        if isinstance(candidate.address, str) and candidate.address.strip():
            return candidate.address.strip()
        if isinstance(candidate.name, str) and candidate.name.strip():
            return candidate.name.strip()
        return None

    def _place_candidate_from_item(
        self,
        item: dict,
        candidate_map: dict[str, PlaceCandidate],
    ) -> Optional[PlaceCandidate]:
        name = item.get("name")
        if not isinstance(name, str) or not name:
            return None
        latitude = item.get("latitude")
        longitude = item.get("longitude")
        if isinstance(latitude, (int, float)) and isinstance(longitude, (int, float)):
            return PlaceCandidate(
                name=name,
                category=item.get("category"),
                address=item.get("notes"),
                latitude=float(latitude),
                longitude=float(longitude),
            )
        matched_candidate = self._find_matching_place_candidate_for_payload(
            item=item,
            candidates=list(candidate_map.values()),
        )
        if matched_candidate is not None:
            return matched_candidate
        notes = item.get("notes")
        if isinstance(notes, str) and notes.strip():
            return PlaceCandidate(
                name=name,
                category=item.get("category"),
                address=notes.strip(),
            )
        return candidate_map.get(name)

    def _place_candidate_from_lat_lng(
        self,
        *,
        name: str,
        coordinates: dict,
    ) -> Optional[PlaceCandidate]:
        latitude = coordinates.get("latitude") if isinstance(coordinates, dict) else None
        longitude = coordinates.get("longitude") if isinstance(coordinates, dict) else None
        if not isinstance(latitude, (int, float)) or not isinstance(longitude, (int, float)):
            return None
        return PlaceCandidate(
            name=name,
            category="location",
            address=name,
            latitude=float(latitude),
            longitude=float(longitude),
        )

    def _resolve_route_departure_datetime(
        self,
        trip_date: date,
        previous_end_time: Optional[str],
    ) -> datetime:
        if previous_end_time:
            try:
                parsed = datetime.strptime(previous_end_time, "%H:%M")
                return datetime.combine(
                    trip_date,
                    time(parsed.hour, parsed.minute),
                    tzinfo=ZoneInfo("Asia/Tokyo"),
                ).astimezone(timezone.utc)
            except ValueError:
                pass
        return datetime.combine(trip_date, time(9, 0), tzinfo=ZoneInfo("Asia/Tokyo")).astimezone(timezone.utc)

    def _route_steps_to_item_payloads(
        self,
        route_steps: list[RouteStep],
        previous_end_time: Optional[str],
        next_start_time: Optional[str],
        origin_name: str,
        destination_name: str,
    ) -> list[dict]:
        payloads: list[dict] = []
        cursor = previous_end_time
        for index, step in enumerate(route_steps):
            start_time = self._to_hhmm(step.departure_time)
            end_time = self._to_hhmm(step.arrival_time)
            if not (start_time and end_time):
                fallback_next = next_start_time if index == len(route_steps) - 1 else None
                start_time, end_time = self._build_transport_time_window(
                    previous_end_time=cursor,
                    next_start_time=fallback_next,
                    travel_minutes=step.duration_minutes,
                )
            if end_time:
                cursor = end_time
            payloads.append(
                self._route_step_to_item_payload(step, start_time, end_time, origin_name, destination_name)
            )
        logger.info(
            "TripService route step payloads built: origin=%s destination=%s payloads=%s line_names=%s",
            origin_name,
            destination_name,
            len(payloads),
            [payload.get("line_name") for payload in payloads if payload.get("line_name")],
        )
        return payloads

    def _route_step_to_item_payload(
        self,
        step: RouteStep,
        start_time: Optional[str],
        end_time: Optional[str],
        origin_name: str,
        destination_name: str,
    ) -> dict:
        mode_label = (
            "徒歩"
            if step.travel_mode == "WALK"
            else "車"
            if step.travel_mode == "DRIVE"
            else "バス"
            if step.transit_subtype == "BUS"
            else "電車"
        )
        transport_mode = (
            "WALK"
            if step.travel_mode == "WALK"
            else "CAR"
            if step.travel_mode == "DRIVE"
            else step.transit_subtype or "TRAIN"
        )
        return {
            "item_type": "transport",
            "name": f"{mode_label}で移動",
            "category": "transport",
            "transport_mode": transport_mode,
            "travel_minutes": step.duration_minutes,
            "distance_meters": step.distance_meters,
            "from_name": step.from_name,
            "to_name": step.to_name,
            "start_time": start_time,
            "end_time": end_time,
            "notes": step.notes,
            "line_name": step.line_name,
            "vehicle_type": step.vehicle_type,
            "departure_stop_name": step.departure_stop_name,
            "arrival_stop_name": step.arrival_stop_name,
        }

    def _count_transit_transport_items(self, normalized_plan: dict[int, list[dict]]) -> tuple[int, int]:
        transit_count = 0
        line_count = 0
        for items in normalized_plan.values():
            for item in items:
                if item.get("item_type") != "transport":
                    continue
                mode = str(item.get("transport_mode") or "").upper()
                if mode not in {"BUS", "TRAIN"}:
                    continue
                transit_count += 1
                if item.get("line_name"):
                    line_count += 1
        return transit_count, line_count

    def _count_transport_diagnostics(self, normalized_plan: dict[int, list[dict]]) -> dict[str, int]:
        attempted_pairs = 0
        transit_pairs = 0
        walk_pairs = 0
        drive_pairs = 0
        for items in normalized_plan.values():
            for item in items:
                if item.get("item_type") != "transport":
                    continue
                attempted_pairs += 1
                mode = str(item.get("transport_mode") or "").upper()
                if mode in {"BUS", "TRAIN"}:
                    transit_pairs += 1
                elif mode == "WALK":
                    walk_pairs += 1
                elif mode == "CAR":
                    drive_pairs += 1
        return {
            "attempted_pairs": attempted_pairs,
            "transit_pairs": transit_pairs,
            "walk_pairs": walk_pairs,
            "drive_pairs": drive_pairs,
        }

    def _normalize_lat_lng(self, value: Optional[dict], *, field_name: str) -> dict:
        if not isinstance(value, dict):
            raise ValueError(f"{field_name} must be an object with latitude/longitude")
        latitude = value.get("latitude")
        longitude = value.get("longitude")
        if isinstance(latitude, bool) or not isinstance(latitude, (int, float)):
            raise ValueError(f"{field_name}.latitude must be numeric")
        if isinstance(longitude, bool) or not isinstance(longitude, (int, float)):
            raise ValueError(f"{field_name}.longitude must be numeric")
        latitude = float(latitude)
        longitude = float(longitude)
        if latitude < -90 or latitude > 90:
            raise ValueError(f"{field_name}.latitude must be between -90 and 90")
        if longitude < -180 or longitude > 180:
            raise ValueError(f"{field_name}.longitude must be between -180 and 180")
        return {"latitude": latitude, "longitude": longitude}

    def _enforce_plan_constraints(
        self,
        trip: Trip,
        days: list[TripDay],
        normalized_plan: dict[int, list[dict]],
    ) -> dict[int, list[dict]]:
        constrained: dict[int, list[dict]] = {}
        sorted_days = sorted(days, key=lambda day: day.day_number)
        for day in sorted_days:
            day_items = list(normalized_plan.get(day.day_number, []))
            capped_place_count = 0
            filtered_items: list[dict] = []
            for item in day_items:
                if not self._is_transport_item_payload(item):
                    capped_place_count += 1
                    if capped_place_count > 5:
                        continue
                filtered_items.append(item)
            day_items = filtered_items
            day_items = self._clamp_day_place_times(day_items)
            day_items = self._reduce_overpacked_after_long_transport(day_items)
            day_items = self._drop_leading_and_trailing_transport(day_items)
            constrained[day.day_number] = day_items

        if not sorted_days:
            return constrained

        first_day = sorted_days[0]
        first_items = constrained.get(first_day.day_number, [])
        first_place = next((item for item in first_items if not self._is_transport_item_payload(item)), None)
        if first_place is not None:
            must_add_head = not first_items or not self._is_transport_item_payload(first_items[0])
            if must_add_head:
                first_items.insert(
                    0,
                    self._build_fallback_transport_item_payload(
                        from_name=trip.origin,
                        to_name=str(first_place.get("name") or trip.destination),
                        previous_end_time=None,
                        next_start_time=first_place.get("start_time"),
                    ),
                )
            constrained[first_day.day_number] = first_items

        for index, day in enumerate(sorted_days):
            items = constrained.get(day.day_number, [])
            if not items:
                continue
            day_lodging = (day.lodging_note or "").strip() or None
            is_last_day = index == len(sorted_days) - 1
            last_place = next((item for item in reversed(items) if not self._is_transport_item_payload(item)), None)
            if is_last_day:
                if last_place is not None:
                    needs_return = not items or not self._is_transport_item_payload(items[-1])
                    if needs_return:
                        items.append(
                            self._build_fallback_transport_item_payload(
                                from_name=str(last_place.get("name") or trip.destination),
                                to_name=trip.origin,
                                previous_end_time=last_place.get("end_time"),
                                next_start_time=None,
                            )
                        )
            elif day_lodging and last_place is not None:
                needs_lodging_return = not items or not self._is_transport_item_payload(items[-1])
                if needs_lodging_return:
                    items.append(
                        self._build_fallback_transport_item_payload(
                            from_name=str(last_place.get("name") or trip.destination),
                            to_name=day_lodging,
                            previous_end_time=last_place.get("end_time"),
                            next_start_time=None,
                        )
                    )
            constrained[day.day_number] = items

        for index in range(1, len(sorted_days)):
            prev_day = sorted_days[index - 1]
            current_day = sorted_days[index]
            start_from = (prev_day.lodging_note or "").strip() or None
            if not start_from:
                continue
            items = constrained.get(current_day.day_number, [])
            first_place = next((item for item in items if not self._is_transport_item_payload(item)), None)
            if first_place is None:
                continue
            if not items or not self._is_transport_item_payload(items[0]):
                items.insert(
                    0,
                    self._build_fallback_transport_item_payload(
                        from_name=start_from,
                        to_name=str(first_place.get("name") or trip.destination),
                        previous_end_time=None,
                        next_start_time=first_place.get("start_time"),
                    )
                )
            constrained[current_day.day_number] = items

        return constrained

    def _clamp_day_place_times(self, items: list[dict]) -> list[dict]:
        clamped: list[dict] = []
        fallback_cursor = self.ACTIVITY_START_TIME
        for item in items:
            if self._is_transport_item_payload(item):
                clamped.append(item)
                continue
            start_time = item.get("start_time") or fallback_cursor
            end_time = item.get("end_time") or self._shift_hhmm(start_time, 90)
            start_time = self._clamp_hhmm(start_time, self.ACTIVITY_START_TIME, "21:30")
            end_time = self._clamp_hhmm(end_time, start_time, self.ACTIVITY_END_TIME)
            if end_time < start_time:
                end_time = start_time
            item["start_time"] = start_time
            item["end_time"] = end_time
            fallback_cursor = self._shift_hhmm(end_time, 15) or self.ACTIVITY_END_TIME
            clamped.append(item)
        return clamped

    def _clamp_hhmm(self, value: Optional[str], minimum: str, maximum: str) -> str:
        raw = value or minimum
        if raw < minimum:
            return minimum
        if raw > maximum:
            return maximum
        return raw

    def _drop_leading_and_trailing_transport(self, items: list[dict]) -> list[dict]:
        if not items:
            return items
        start = 0
        end = len(items)
        while start < end and self._is_transport_item_payload(items[start]):
            start += 1
        while end > start and self._is_transport_item_payload(items[end - 1]):
            end -= 1
        return items[start:end]

    def _reduce_overpacked_after_long_transport(self, items: list[dict]) -> list[dict]:
        reduced: list[dict] = []
        long_transfer_seen = False
        place_after_long_transfer = 0
        for item in items:
            if self._is_transport_item_payload(item):
                travel_minutes = self._to_optional_int(item.get("travel_minutes")) or 0
                if travel_minutes >= 180:
                    long_transfer_seen = True
                    place_after_long_transfer = 0
                reduced.append(item)
                continue
            if long_transfer_seen:
                place_after_long_transfer += 1
                if place_after_long_transfer > 2:
                    continue
            reduced.append(item)
        return reduced

    def _to_hhmm(self, value: Optional[datetime]) -> Optional[str]:
        if value is None:
            return None
        return value.astimezone(self._jst).strftime("%H:%M")

    def _shift_hhmm(self, value: str, delta_minutes: int) -> Optional[str]:
        try:
            parsed = datetime.strptime(value, "%H:%M")
        except ValueError:
            return None
        shifted = parsed + timedelta(minutes=delta_minutes)
        return shifted.strftime("%H:%M")

    def _is_transport_item_payload(self, item: dict) -> bool:
        return item.get("item_type") == "transport" or item.get("transport_mode") is not None
