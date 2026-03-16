from typing import Optional

from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

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
from app.infrastructure.database.models import (
    IncidentModel,
    AiPlanGenerationModel,
    ItineraryItemModel,
    ReplanItemModel,
    ReplanSessionModel,
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
                select(ItineraryItemModel)
                .join(TripDayModel, TripDayModel.id == ItineraryItemModel.trip_day_id)
                .where(TripDayModel.trip_id == trip_id)
                .order_by(
                    TripDayModel.day_number.asc(),
                    ItineraryItemModel.sequence.asc().nulls_last(),
                    ItineraryItemModel.start_time.asc().nulls_last(),
                    ItineraryItemModel.id.asc(),
                )
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
        # 1. replan_items を削除（replan_sessions, itinerary_items より先に削除が必要）
        session_ids_result = await self.db.execute(
            select(ReplanSessionModel.id).where(ReplanSessionModel.trip_id == trip_id)
        )
        session_ids = list(session_ids_result.scalars().all())
        if session_ids:
            await self.db.execute(
                delete(ReplanItemModel).where(
                    ReplanItemModel.replan_session_id.in_(session_ids)
                )
            )

        # 2. replan_sessions を削除
        await self.db.execute(
            delete(ReplanSessionModel).where(ReplanSessionModel.trip_id == trip_id)
        )

        # 3. incidents を削除
        await self.db.execute(
            delete(IncidentModel).where(IncidentModel.trip_id == trip_id)
        )

        # 4. itinerary_items, trip_days, trip_members, trip_preferences, trips を削除
        days_result = await self.db.execute(
            select(TripDayModel.id).where(TripDayModel.trip_id == trip_id)
        )
        day_ids = list(days_result.scalars().all())
        if day_ids:
            await self.db.execute(
                delete(ItineraryItemModel).where(
                    ItineraryItemModel.trip_day_id.in_(day_ids)
                )
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
        try:
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            raise ValueError("Trip member already exists") from exc
        await self.db.refresh(db_member)
        return self._to_member_entity(db_member)

    async def get_member(self, trip_id: int, user_id: int) -> Optional[TripMember]:
        result = await self.db.execute(
            select(TripMemberModel).where(
                TripMemberModel.trip_id == trip_id,
                TripMemberModel.user_id == user_id,
            )
        )
        db_member = result.scalar_one_or_none()
        if db_member is None:
            return None
        return self._to_member_entity(db_member)

    async def update_member(self, member: TripMember) -> Optional[TripMember]:
        result = await self.db.execute(
            select(TripMemberModel).where(
                TripMemberModel.trip_id == member.trip_id,
                TripMemberModel.user_id == member.user_id,
            )
        )
        db_member = result.scalar_one_or_none()
        if db_member is None:
            return None

        db_member.role = member.role
        db_member.status = member.status

        await self.db.commit()
        await self.db.refresh(db_member)
        return self._to_member_entity(db_member)

    async def delete_member(self, trip_id: int, user_id: int) -> bool:
        result = await self.db.execute(
            delete(TripMemberModel).where(
                TripMemberModel.trip_id == trip_id,
                TripMemberModel.user_id == user_id,
            )
        )
        await self.db.commit()
        return result.rowcount > 0

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

    async def create_day(self, day: TripDay) -> TripDay:
        db_day = TripDayModel(
            trip_id=day.trip_id,
            day_number=day.day_number,
            date=day.date,
        )
        self.db.add(db_day)
        await self.db.commit()
        await self.db.refresh(db_day)
        return self._to_day_entity(db_day)

    async def get_day(self, day_id: int) -> Optional[TripDay]:
        result = await self.db.execute(select(TripDayModel).where(TripDayModel.id == day_id))
        db_day = result.scalar_one_or_none()
        if db_day is None:
            return None
        return self._to_day_entity(db_day)

    async def update_day(self, day: TripDay) -> Optional[TripDay]:
        result = await self.db.execute(select(TripDayModel).where(TripDayModel.id == day.id))
        db_day = result.scalar_one_or_none()
        if db_day is None:
            return None

        db_day.day_number = day.day_number
        db_day.date = day.date

        await self.db.commit()
        await self.db.refresh(db_day)
        return self._to_day_entity(db_day)

    async def delete_day(self, day_id: int) -> bool:
        await self.db.execute(delete(ItineraryItemModel).where(ItineraryItemModel.trip_day_id == day_id))
        result = await self.db.execute(delete(TripDayModel).where(TripDayModel.id == day_id))
        await self.db.commit()
        return result.rowcount > 0

    async def create_item(self, item: ItineraryItem) -> ItineraryItem:
        db_item = ItineraryItemModel(
            trip_day_id=item.trip_day_id,
            name=item.name,
            sequence=item.sequence,
            category=item.category,
            latitude=item.latitude,
            longitude=item.longitude,
            start_time=item.start_time,
            end_time=item.end_time,
            estimated_cost=item.estimated_cost,
            notes=item.notes,
        )
        self.db.add(db_item)
        await self.db.commit()
        await self.db.refresh(db_item)
        return self._to_item_entity(db_item)

    async def get_item(self, item_id: int) -> Optional[ItineraryItem]:
        result = await self.db.execute(select(ItineraryItemModel).where(ItineraryItemModel.id == item_id))
        db_item = result.scalar_one_or_none()
        if db_item is None:
            return None
        return self._to_item_entity(db_item)

    async def update_item(self, item: ItineraryItem) -> Optional[ItineraryItem]:
        result = await self.db.execute(select(ItineraryItemModel).where(ItineraryItemModel.id == item.id))
        db_item = result.scalar_one_or_none()
        if db_item is None:
            return None

        db_item.name = item.name
        db_item.sequence = item.sequence
        db_item.category = item.category
        db_item.latitude = item.latitude
        db_item.longitude = item.longitude
        db_item.start_time = item.start_time
        db_item.end_time = item.end_time
        db_item.estimated_cost = item.estimated_cost
        db_item.notes = item.notes

        await self.db.commit()
        await self.db.refresh(db_item)
        return self._to_item_entity(db_item)

    async def delete_item(self, item_id: int) -> bool:
        # replacement_for_item_id が該当アイテムを参照している replan_items を NULL に更新
        await self.db.execute(
            update(ReplanItemModel)
            .where(ReplanItemModel.replacement_for_item_id == item_id)
            .values(replacement_for_item_id=None)
        )
        result = await self.db.execute(
            delete(ItineraryItemModel).where(ItineraryItemModel.id == item_id)
        )
        await self.db.commit()
        return result.rowcount > 0

    async def create_ai_plan_generation(self, generation: AiPlanGeneration) -> AiPlanGeneration:
        db_generation = AiPlanGenerationModel(
            trip_id=generation.trip_id,
            status=generation.status,
            provider=generation.provider,
            prompt_version=generation.prompt_version,
            requested_at=generation.requested_at,
            started_at=generation.started_at,
            finished_at=generation.finished_at,
            error_message=generation.error_message,
            result_summary_json=generation.result_summary_json,
        )
        self.db.add(db_generation)
        await self.db.commit()
        await self.db.refresh(db_generation)
        return self._to_ai_plan_generation_entity(db_generation)

    async def get_ai_plan_generation(self, generation_id: int) -> Optional[AiPlanGeneration]:
        result = await self.db.execute(
            select(AiPlanGenerationModel).where(AiPlanGenerationModel.id == generation_id)
        )
        db_generation = result.scalar_one_or_none()
        if db_generation is None:
            return None
        return self._to_ai_plan_generation_entity(db_generation)

    async def update_ai_plan_generation(
        self, generation: AiPlanGeneration
    ) -> Optional[AiPlanGeneration]:
        if generation.id is None:
            return None
        result = await self.db.execute(
            select(AiPlanGenerationModel).where(AiPlanGenerationModel.id == generation.id)
        )
        db_generation = result.scalar_one_or_none()
        if db_generation is None:
            return None

        db_generation.status = generation.status
        db_generation.provider = generation.provider
        db_generation.prompt_version = generation.prompt_version
        db_generation.requested_at = generation.requested_at
        db_generation.started_at = generation.started_at
        db_generation.finished_at = generation.finished_at
        db_generation.error_message = generation.error_message
        db_generation.result_summary_json = generation.result_summary_json

        await self.db.commit()
        await self.db.refresh(db_generation)
        return self._to_ai_plan_generation_entity(db_generation)

    async def list_days_by_trip(self, trip_id: int) -> list[TripDay]:
        result = await self.db.execute(
            select(TripDayModel)
            .where(TripDayModel.trip_id == trip_id)
            .order_by(TripDayModel.day_number.asc())
        )
        db_days = result.scalars().all()
        return [self._to_day_entity(db_day) for db_day in db_days]

    async def delete_items_by_trip(self, trip_id: int) -> int:
        day_ids_result = await self.db.execute(
            select(TripDayModel.id).where(TripDayModel.trip_id == trip_id)
        )
        day_ids = list(day_ids_result.scalars().all())
        if not day_ids:
            return 0

        result = await self.db.execute(
            delete(ItineraryItemModel).where(ItineraryItemModel.trip_day_id.in_(day_ids))
        )
        await self.db.commit()
        return result.rowcount or 0

    async def replace_items_by_trip(self, trip_id: int, items: list[ItineraryItem]) -> int:
        day_ids_result = await self.db.execute(
            select(TripDayModel.id).where(TripDayModel.trip_id == trip_id)
        )
        day_ids = list(day_ids_result.scalars().all())
        if not day_ids:
            return 0

        await self.db.execute(
            delete(ItineraryItemModel).where(ItineraryItemModel.trip_day_id.in_(day_ids))
        )
        for item in items:
            self.db.add(
                ItineraryItemModel(
                    trip_day_id=item.trip_day_id,
                    name=item.name,
                    sequence=item.sequence,
                    category=item.category,
                    latitude=item.latitude,
                    longitude=item.longitude,
                    start_time=item.start_time,
                    end_time=item.end_time,
                    estimated_cost=item.estimated_cost,
                    notes=item.notes,
                )
            )
        await self.db.commit()
        return len(items)

    async def create_incident(self, incident: Incident) -> Incident:
        db_incident = IncidentModel(
            trip_id=incident.trip_id,
            incident_type=incident.incident_type,
            description=incident.description,
            occurred_at=incident.occurred_at,
        )
        self.db.add(db_incident)
        await self.db.commit()
        await self.db.refresh(db_incident)
        return self._to_incident_entity(db_incident)

    async def list_incidents(self, trip_id: int) -> list[Incident]:
        result = await self.db.execute(
            select(IncidentModel)
            .where(IncidentModel.trip_id == trip_id)
            .order_by(IncidentModel.created_at.desc())
        )
        db_incidents = result.scalars().all()
        return [self._to_incident_entity(db_incident) for db_incident in db_incidents]

    async def get_incident(self, incident_id: int) -> Optional[Incident]:
        result = await self.db.execute(select(IncidentModel).where(IncidentModel.id == incident_id))
        db_incident = result.scalar_one_or_none()
        if db_incident is None:
            return None
        return self._to_incident_entity(db_incident)

    async def create_replan_session(
        self,
        session: ReplanSession,
        items: Optional[list[ReplanItem]] = None,
    ) -> ReplanAggregate:
        db_session = ReplanSessionModel(
            trip_id=session.trip_id,
            incident_id=session.incident_id,
            reason=session.reason,
        )
        self.db.add(db_session)
        await self.db.flush()

        created_items: list[ReplanItemModel] = []
        for item in items or []:
            db_item = ReplanItemModel(
                replan_session_id=db_session.id,
                name=item.name,
                category=item.category,
                latitude=item.latitude,
                longitude=item.longitude,
                start_time=item.start_time,
                estimated_cost=item.estimated_cost,
                replacement_for_item_id=item.replacement_for_item_id,
            )
            self.db.add(db_item)
            created_items.append(db_item)

        await self.db.commit()
        await self.db.refresh(db_session)
        for db_item in created_items:
            await self.db.refresh(db_item)

        return ReplanAggregate(
            session=self._to_replan_session_entity(db_session),
            items=[self._to_replan_item_entity(db_item) for db_item in created_items],
        )

    async def get_replan_aggregate(self, session_id: int) -> Optional[ReplanAggregate]:
        session_result = await self.db.execute(
            select(ReplanSessionModel).where(ReplanSessionModel.id == session_id)
        )
        db_session = session_result.scalar_one_or_none()
        if db_session is None:
            return None

        items_result = await self.db.execute(
            select(ReplanItemModel).where(ReplanItemModel.replan_session_id == session_id)
        )
        db_items = items_result.scalars().all()

        return ReplanAggregate(
            session=self._to_replan_session_entity(db_session),
            items=[self._to_replan_item_entity(db_item) for db_item in db_items],
        )

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
            sequence=db_item.sequence,
            category=db_item.category,
            latitude=db_item.latitude,
            longitude=db_item.longitude,
            start_time=db_item.start_time,
            end_time=db_item.end_time,
            estimated_cost=db_item.estimated_cost,
            notes=db_item.notes,
            created_at=db_item.created_at,
        )

    def _to_incident_entity(self, db_incident: IncidentModel) -> Incident:
        return Incident(
            id=db_incident.id,
            trip_id=db_incident.trip_id,
            incident_type=db_incident.incident_type,
            description=db_incident.description,
            occurred_at=db_incident.occurred_at,
            created_at=db_incident.created_at,
        )

    def _to_replan_session_entity(self, db_session: ReplanSessionModel) -> ReplanSession:
        return ReplanSession(
            id=db_session.id,
            trip_id=db_session.trip_id,
            incident_id=db_session.incident_id,
            reason=db_session.reason,
            created_at=db_session.created_at,
        )

    def _to_replan_item_entity(self, db_item: ReplanItemModel) -> ReplanItem:
        return ReplanItem(
            id=db_item.id,
            replan_session_id=db_item.replan_session_id,
            name=db_item.name,
            category=db_item.category,
            latitude=db_item.latitude,
            longitude=db_item.longitude,
            start_time=db_item.start_time,
            estimated_cost=db_item.estimated_cost,
            replacement_for_item_id=db_item.replacement_for_item_id,
            created_at=db_item.created_at,
        )

    def _to_ai_plan_generation_entity(
        self, db_generation: AiPlanGenerationModel
    ) -> AiPlanGeneration:
        return AiPlanGeneration(
            id=db_generation.id,
            trip_id=db_generation.trip_id,
            status=db_generation.status,
            provider=db_generation.provider,
            prompt_version=db_generation.prompt_version,
            requested_at=db_generation.requested_at,
            started_at=db_generation.started_at,
            finished_at=db_generation.finished_at,
            error_message=db_generation.error_message,
            result_summary_json=db_generation.result_summary_json,
        )
