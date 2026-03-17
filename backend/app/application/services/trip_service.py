import asyncio
import json
from datetime import date, datetime, time, timedelta, timezone
from typing import Optional

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
from app.infrastructure.external import GeminiClient, GooglePlacesClient, PlaceCandidate
from app.shared.exceptions import (
    AiPlanGenerationNotFoundError,
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
        if trip.participant_count < 1:
            raise ValueError("participant_count must be greater than or equal to 1")
        if trip.save_count < 0:
            raise ValueError("save_count must be greater than or equal to 0")
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

        if "participant_count" in kwargs and kwargs["participant_count"] is not None:
            if kwargs["participant_count"] < 1:
                raise ValueError("participant_count must be greater than or equal to 1")
        if "save_count" in kwargs and kwargs["save_count"] is not None:
            if kwargs["save_count"] < 0:
                raise ValueError("save_count must be greater than or equal to 0")

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

    async def start_my_ai_plan_generation(
        self,
        owner_user_id: int,
        trip_id: int,
        provider: Optional[str] = None,
        prompt_version: Optional[str] = None,
        run_async: bool = True,
    ) -> AiPlanGeneration:
        await self.get_my_trip_detail(user_id=owner_user_id, trip_id=trip_id)

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

    async def execute_ai_plan_generation(self, generation_id: int) -> AiPlanGeneration:
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
            )
            plan_payload = await self._generate_plan_payload(
                trip=aggregate.trip,
                preference=aggregate.preference,
                days=days,
                place_candidates=place_candidates,
            )
            normalized = self._normalize_plan_payload(
                plan_payload=plan_payload,
                days=days,
                fallback_candidates=place_candidates,
            )
            inserted_count = await self._replace_itinerary_items(
                days=days,
                normalized_plan=normalized,
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
        return merged

    async def _generate_plan_payload(
        self,
        trip: Trip,
        preference: Optional[TripPreference],
        days: list[TripDay],
        place_candidates: list[PlaceCandidate],
    ) -> dict:
        gemini_client = GeminiClient()
        prompt = self._build_gemini_prompt(
            trip=trip,
            preference=preference,
            days=days,
            place_candidates=place_candidates,
        )
        return await gemini_client.generate_json(prompt=prompt, temperature=0.2)

    def _build_gemini_prompt(
        self,
        trip: Trip,
        preference: Optional[TripPreference],
        days: list[TripDay],
        place_candidates: list[PlaceCandidate],
    ) -> str:
        days_payload = [
            {"day_number": d.day_number, "date": d.date.isoformat() if d.date is not None else None}
            for d in days
        ]
        candidates_payload = [candidate.to_dict() for candidate in place_candidates]
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
        return (
            "旅行日程を最適化してください。必ずJSONオブジェクトのみを返してください。\n"
            "フォーマット: {\"days\": [{\"day_number\": 1, \"items\": [{\"name\": \"\", "
            "\"category\": \"\", \"latitude\": 0, \"longitude\": 0, \"start_time\": \"09:00\", "
            "\"end_time\": \"10:30\", \"estimated_cost\": 0, \"notes\": \"\"}]}]}\n"
            f"trip={json.dumps({'origin': trip.origin, 'destination': trip.destination}, ensure_ascii=False)}\n"
            f"days={json.dumps(days_payload, ensure_ascii=False)}\n"
            f"preference={json.dumps(preference_payload, ensure_ascii=False)}\n"
            f"candidates={json.dumps(candidates_payload, ensure_ascii=False)}\n"
            "ルール:\n"
            "- day_number は必ず存在し、入力 days と一致させる\n"
            "- items は各日2-5件\n"
            "- start_time/end_time は HH:MM\n"
            "- candidatesにある名称を優先利用\n"
        )

    def _normalize_plan_payload(
        self,
        plan_payload: dict,
        days: list[TripDay],
        fallback_candidates: list[PlaceCandidate],
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
            return by_day

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
        return by_day

    async def _replace_itinerary_items(
        self,
        days: list[TripDay],
        normalized_plan: dict[int, list[dict]],
    ) -> int:
        if not days:
            return 0

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
                    category=raw.get("category"),
                    latitude=raw.get("latitude"),
                    longitude=raw.get("longitude"),
                    start_time=self._build_datetime(day.date, raw.get("start_time")),
                    end_time=self._build_datetime(day.date, raw.get("end_time")),
                    estimated_cost=self._to_optional_int(raw.get("estimated_cost")),
                    notes=raw.get("notes"),
                )
                if not generated_item.name:
                    continue
                items_to_insert.append(generated_item)
        return await self.trip_repository.replace_items_by_trip(days[0].trip_id, items_to_insert)

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
