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
    TripDay,
    TripMember,
    TripPreference,
)
from app.domain.repositories.trip_repository import TripRepository
from app.infrastructure.external import GeminiClient, GooglePlacesClient, PlaceCandidate, RouteOption, RouteStep, RoutesClient
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


class TripService:
    """Trip application service."""

    ALLOWED_RECOMMENDATION_CATEGORIES = {"カフェ", "夜景", "グルメ", "温泉"}
    ALLOWED_TRIP_STATUSES = {"planned", "ongoing", "completed"}
    MAX_PARTICIPANT_COUNT = 10
    MAX_TRIP_DAYS = 3
    MAX_ROUTE_CANDIDATES = 8
    MAX_NEAREST_DESTINATIONS_PER_CANDIDATE = 3

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
            raise ValueError(
                f"participant_count must be less than or equal to {self.MAX_PARTICIPANT_COUNT}"
            )
        if (trip.end_date - trip.start_date).days + 1 > self.MAX_TRIP_DAYS:
            raise ValueError(f"trip duration must be less than or equal to {self.MAX_TRIP_DAYS} days")
        if trip.save_count < 0:
            raise ValueError("save_count must be greater than or equal to 0")
        invalid_categories = [
            category for category in trip.recommendation_categories
            if category not in self.ALLOWED_RECOMMENDATION_CATEGORIES
        ]
        if invalid_categories:
            raise ValueError("recommendation_categories contains invalid values")
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
            raise ValueError(
                f"participant_count must be less than or equal to {self.MAX_PARTICIPANT_COUNT}"
            )
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
                category for category in kwargs["recommendation_categories"]
                if category not in self.ALLOWED_RECOMMENDATION_CATEGORIES
            ]
            if invalid_categories:
                raise ValueError("recommendation_categories contains invalid values")

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

    async def start_my_ai_plan_generation(
        self,
        owner_user_id: int,
        trip_id: int,
        provider: Optional[str] = None,
        prompt_version: Optional[str] = None,
        run_async: bool = True,
        must_visit_places: Optional[list[str]] = None,
        lodging_notes: Optional[list[str]] = None,
        additional_request_comment: Optional[str] = None,
        selected_companion_names: Optional[list[str]] = None,
    ) -> AiPlanGeneration:
        await self.get_my_trip_detail(user_id=owner_user_id, trip_id=trip_id)

        generation_input = {
            "must_visit_places": _normalize_generation_text_items(must_visit_places),
            "lodging_notes": _normalize_generation_text_items(lodging_notes),
            "additional_request_comment": (additional_request_comment or "").strip() or None,
            "selected_companion_names": _normalize_generation_text_items(selected_companion_names),
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
            asyncio.create_task(self.run_ai_plan_generation_in_background(created.id))
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
    async def run_ai_plan_generation_in_background(generation_id: int) -> None:
        """Run generation with a fresh DB session so request lifecycle does not interfere."""
        from app.infrastructure.database.base import SessionLocal
        from app.infrastructure.repositories.trip_repository_impl import TripRepositoryImpl

        async with SessionLocal() as db:
            repo = TripRepositoryImpl(db)
            service = TripService(repo)
            await service.execute_ai_plan_generation(generation_id)

    async def execute_ai_plan_generation(
        self,
        generation_id: int,
        generation_input: Optional[dict] = None,
    ) -> AiPlanGeneration:
        generation = await self.trip_repository.get_ai_plan_generation(generation_id)
        if generation is None:
            raise AiPlanGenerationNotFoundError(
                f"AI plan generation with ID {generation_id} not found"
            )
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
            )
            normalized = await self._rebuild_transport_items_from_routes(
                trip=aggregate.trip,
                days=days,
                normalized_plan=normalized,
                place_candidates=place_candidates,
            )
            generated_items = self._build_generated_itinerary_items(days=days, normalized_plan=normalized)
            inserted_count = await self.trip_repository.replace_items_by_trip(aggregate.trip.id, generated_items)
            if not aggregate.trip.recommendation_comment:
                aggregate.trip.recommendation_comment = build_trip_recommendation_comment(
                    destination=aggregate.trip.destination,
                    preference=aggregate.preference,
                    recommendation_categories=aggregate.trip.recommendation_categories,
                )
                await self.trip_repository.update_trip(aggregate.trip)
            cover_image_updated = await self._update_trip_cover_image_from_itinerary(
                trip=aggregate.trip,
                itinerary_items=generated_items,
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

    async def _ensure_trip_days(
        self,
        trip_id: int,
        start_date: date,
        end_date: date,
    ) -> list[TripDay]:
        days = await self.trip_repository.list_days_by_trip(trip_id)
        if days:
            return days

        total_days = (end_date - start_date).days + 1
        if total_days <= 0:
            total_days = 1

        for index in range(total_days):
            await self.trip_repository.create_day(
                TripDay(
                    id=None,
                    trip_id=trip_id,
                    day_number=index + 1,
                    date=start_date + timedelta(days=index),
                )
            )
        return await self.trip_repository.list_days_by_trip(trip_id)

    async def _collect_place_candidates(
        self,
        destination: str,
        preference: Optional[TripPreference],
        max_candidates: int,
        must_visit_places: Optional[list[str]] = None,
    ) -> list[PlaceCandidate]:
        place_client = GooglePlacesClient()
        atmosphere_hint = preference.atmosphere.value if preference is not None else ""
        queries = [
            f"{destination} 観光地",
            f"{destination} 人気スポット",
            f"{destination} レストラン",
            f"{destination} カフェ",
        ]
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
                key = (result.name, result.address or "")
                if key in seen:
                    continue
                seen.add(key)
                merged.append(result)
                if len(merged) >= max_candidates:
                    return merged
        if merged:
            return merged
        return [
            PlaceCandidate(
                name=f"{destination} 散策",
                address=destination,
                category="tourist_attraction",
            )
        ]

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
            {"day_number": d.day_number, "date": d.date.isoformat() if d.date is not None else None}
            for d in days
        ]
        candidates_payload = [candidate.to_dict() for candidate in place_candidates]
        selected_transport_types = self._parse_selected_transport_types(preference.transport_type if preference is not None else None)
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
        lodging_notes = _normalize_generation_text_items(generation_input.get("lodging_notes"))
        selected_companion_names = _normalize_generation_text_items(generation_input.get("selected_companion_names"))
        additional_request_comment = (generation_input.get("additional_request_comment") or "").strip() or None
        return (
            "旅行日程を最適化してください。必ずJSONオブジェクトのみを返してください。\n"
            "フォーマット: {\"days\": [{\"day_number\": 1, \"items\": ["
            "{\"item_type\": \"place\", \"name\": \"\", \"category\": \"\", \"latitude\": 0, "
            "\"longitude\": 0, \"start_time\": \"09:00\", \"end_time\": \"10:30\", "
            "\"estimated_cost\": 0, \"notes\": \"\"}, "
            "{\"item_type\": \"transport\", \"name\": \"徒歩で移動\", \"transport_mode\": \"WALK\", "
            "\"travel_minutes\": 15, \"distance_meters\": 1200, \"from_name\": \"A\", \"to_name\": \"B\", "
            "\"start_time\": \"10:30\", \"end_time\": \"10:45\", \"notes\": \"徒歩で移動 / 約15分 / 約1.2km\"}"
            "]}]}\n"
            f"trip={json.dumps({'origin': trip.origin, 'destination': trip.destination}, ensure_ascii=False)}\n"
            f"days={json.dumps(days_payload, ensure_ascii=False)}\n"
            f"preference={json.dumps(preference_payload, ensure_ascii=False)}\n"
            f"recommended_categories={json.dumps(trip.recommendation_categories, ensure_ascii=False)}\n"
            f"selected_transport_types={json.dumps(selected_transport_types, ensure_ascii=False)}\n"
            f"must_visit_places={json.dumps(must_visit_places, ensure_ascii=False)}\n"
            f"lodging_notes={json.dumps(lodging_notes, ensure_ascii=False)}\n"
            f"selected_companion_names={json.dumps(selected_companion_names, ensure_ascii=False)}\n"
            f"additional_request_comment={json.dumps(additional_request_comment, ensure_ascii=False)}\n"
            f"candidates={json.dumps(candidates_payload, ensure_ascii=False)}\n"
            f"route_options={json.dumps(route_options_payload, ensure_ascii=False)}\n"
            "ルール:\n"
            "- day_number は必ず存在し、入力 days と一致させる\n"
            "- items は place と transport を時系列に並べる\n"
            "- place は各日2-5件\n"
            "- place 同士の間には transport を入れる\n"
            "- start_time/end_time は HH:MM\n"
            "- candidatesにある名称を優先利用\n"
            "- recommended_categories にあるカテゴリは、可能な限り各カテゴリを少なくとも1回は含める\n"
            "- transport は selected_transport_types に対応するものを優先して使う\n"
            "- 徒歩は selected_transport_types に含まれていなくても使ってよい\n"
            "- 徒歩以外で、selected_transport_types に含まれない移動手段は絶対に使わない\n"
            "- transport は route_options にある候補を優先して使う\n"
            "- route_options が不足する場合も、徒歩以外で selected_transport_types に無い手段は使わない\n"
            "- must_visit_places がある場合は、実現可能な範囲で優先して組み込む\n"
            "- lodging_notes は各日の夜の帰着や宿泊候補として尊重する\n"
            "- additional_request_comment に書かれた希望や制約を優先する\n"
            "- selected_companion_names は同行者コンテキストとして扱い、二人旅やグループ旅行らしい無理のないプランにする\n"
        )

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
        candidates = [candidate for candidate in place_candidates if candidate.latitude is not None and candidate.longitude is not None]
        candidates = candidates[: self.MAX_ROUTE_CANDIDATES]
        if len(candidates) < 2:
            return []

        departure_date = days[0].date if days and days[0].date is not None else trip.start_date
        local_departure_time = datetime.combine(departure_date, time(9, 0)).replace(tzinfo=ZoneInfo("Asia/Tokyo"))
        departure_time = local_departure_time.astimezone(timezone.utc)
        route_client = RoutesClient()

        pair_candidates: list[tuple[PlaceCandidate, PlaceCandidate]] = []
        seen_pairs: set[tuple[str, float, float, str, float, float]] = set()
        for origin in candidates:
            nearest_destinations = sorted(
                [destination for destination in candidates if destination.name != origin.name],
                key=lambda destination: self._estimate_distance_meters(origin, destination),
            )[: self.MAX_NEAREST_DESTINATIONS_PER_CANDIDATE]
            for destination in nearest_destinations:
                key = (
                    origin.name,
                    origin.latitude,
                    origin.longitude,
                    destination.name,
                    destination.latitude,
                    destination.longitude,
                )
                if key in seen_pairs:
                    continue
                seen_pairs.add(key)
                pair_candidates.append((origin, destination))

        results = await asyncio.gather(
            *[
                route_client.compute_route_options(origin=origin, destination=destination, departure_time=departure_time)
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
    ) -> dict[int, list[dict]]:
        by_day: dict[int, list[dict]] = {day.day_number: [] for day in days}
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
                    if isinstance(item, dict) and item.get("name"):
                        by_day[day_number].append(item)

        if any(by_day.values()):
            return {
                day_number: self._inject_transport_items(items, route_options)
                for day_number, items in by_day.items()
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
        return {
            day_number: self._inject_transport_items(items, route_options)
            for day_number, items in by_day.items()
        }

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
                    estimated_cost=self._to_optional_int(raw.get("estimated_cost")),
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
        place_items = [
            item
            for item in itinerary_items
            if item.item_type == "place" and item.name
        ]
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
            candidate for candidate in search_pool
            if self._normalize_place_name(candidate.name) == normalized_item_name
        ]
        if exact_matches:
            return self._pick_best_place_candidate(item, exact_matches)

        partial_matches = [
            candidate for candidate in search_pool
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
        return (lat_delta ** 2 + lon_delta ** 2) ** 0.5

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
        if origin.latitude is None or origin.longitude is None or destination.latitude is None or destination.longitude is None:
            return float("inf")
        lat_scale = 111_000
        lon_scale = 91_000
        lat_delta = (origin.latitude - destination.latitude) * lat_scale
        lon_delta = (origin.longitude - destination.longitude) * lon_scale
        return (lat_delta ** 2 + lon_delta ** 2) ** 0.5

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
                injected.append(self._route_option_to_item_payload(option, item.get("end_time"), next_item.get("start_time")))
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
            "transport_mode": option.travel_mode if option.travel_mode == "WALK" else option.transit_subtype or "TRAIN",
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
    ) -> dict:
        travel_minutes = self._infer_fallback_travel_minutes(previous_end_time, next_start_time)
        start_time, end_time = self._build_transport_time_window(
            previous_end_time=previous_end_time,
            next_start_time=next_start_time,
            travel_minutes=travel_minutes,
        )
        summary = f"{from_name} → {to_name}"
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
    ) -> dict[int, list[dict]]:
        candidate_map = {candidate.name: candidate for candidate in place_candidates}
        rebuilt: dict[int, list[dict]] = {}
        route_client = RoutesClient()

        for day in days:
            items = normalized_plan.get(day.day_number, [])
            place_items = [item for item in items if not self._is_transport_item_payload(item)]
            if len(place_items) < 2:
                rebuilt[day.day_number] = place_items
                continue

            expanded: list[dict] = []
            for index, item in enumerate(place_items):
                expanded.append(item)
                if index == len(place_items) - 1:
                    continue

                next_item = place_items[index + 1]
                origin = self._place_candidate_from_item(item, candidate_map)
                destination = self._place_candidate_from_item(next_item, candidate_map)
                if origin is None or destination is None:
                    expanded.append(
                        self._build_fallback_transport_item_payload(
                            from_name=str(item.get("name")),
                            to_name=str(next_item.get("name")),
                            previous_end_time=item.get("end_time"),
                            next_start_time=next_item.get("start_time"),
                        )
                    )
                    continue

                departure_time = self._resolve_route_departure_datetime(
                    trip_date=day.date or trip.start_date,
                    previous_end_time=item.get("end_time"),
                )
                route_steps = await route_client.compute_route_steps(
                    origin=origin,
                    destination=destination,
                    departure_time=departure_time,
                )
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
                            origin_name=str(item.get("name")),
                            destination_name=str(next_item.get("name")),
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
                        )
                    )
            rebuilt[day.day_number] = expanded
        return rebuilt

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
        return candidate_map.get(name)

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
            payloads.append(self._route_step_to_item_payload(step, start_time, end_time, origin_name, destination_name))
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
        mode_label = "徒歩" if step.travel_mode == "WALK" else "バス" if step.transit_subtype == "BUS" else "電車"
        return {
            "item_type": "transport",
            "name": f"{mode_label}で移動",
            "category": "transport",
            "transport_mode": step.travel_mode if step.travel_mode == "WALK" else step.transit_subtype or "TRAIN",
            "travel_minutes": step.duration_minutes,
            "distance_meters": step.distance_meters,
            "from_name": step.from_name or origin_name,
            "to_name": step.to_name or destination_name,
            "start_time": start_time,
            "end_time": end_time,
            "notes": step.notes,
            "line_name": step.line_name,
            "vehicle_type": step.vehicle_type,
            "departure_stop_name": step.departure_stop_name,
            "arrival_stop_name": step.arrival_stop_name,
        }

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
