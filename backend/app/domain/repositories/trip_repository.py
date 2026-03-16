from abc import ABC, abstractmethod
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


class TripRepository(ABC):
    """Trip aggregate repository interface."""

    @abstractmethod
    async def create_trip(self, trip: Trip, preference: Optional[TripPreference] = None) -> TripAggregate:
        """Create a trip and optionally its preference in one transaction."""
        pass

    @abstractmethod
    async def get_trip_aggregate(self, trip_id: int) -> Optional[TripAggregate]:
        """Get a full trip aggregate by trip id."""
        pass

    @abstractmethod
    async def list_by_user(self, user_id: int, skip: int = 0, limit: int = 100) -> list[Trip]:
        """List trips for a user."""
        pass

    @abstractmethod
    async def update_trip(self, trip: Trip) -> Optional[Trip]:
        """Update a trip."""
        pass

    @abstractmethod
    async def delete_trip(self, trip_id: int) -> bool:
        """Delete a trip."""
        pass

    @abstractmethod
    async def add_member(self, member: TripMember) -> TripMember:
        """Add a member to a trip."""
        pass

    @abstractmethod
    async def get_member(self, trip_id: int, user_id: int) -> Optional[TripMember]:
        """Get a member by trip and user."""
        pass

    @abstractmethod
    async def update_member(self, member: TripMember) -> Optional[TripMember]:
        """Update a trip member."""
        pass

    @abstractmethod
    async def delete_member(self, trip_id: int, user_id: int) -> bool:
        """Delete a member from a trip."""
        pass

    @abstractmethod
    async def upsert_preference(self, preference: TripPreference) -> TripPreference:
        """Create or update trip preference."""
        pass

    @abstractmethod
    async def create_day(self, day: TripDay) -> TripDay:
        """Create a trip day."""
        pass

    @abstractmethod
    async def get_day(self, day_id: int) -> Optional[TripDay]:
        """Get a trip day by id."""
        pass

    @abstractmethod
    async def update_day(self, day: TripDay) -> Optional[TripDay]:
        """Update a trip day."""
        pass

    @abstractmethod
    async def delete_day(self, day_id: int) -> bool:
        """Delete a trip day."""
        pass

    @abstractmethod
    async def create_item(self, item: ItineraryItem) -> ItineraryItem:
        """Create an itinerary item."""
        pass

    @abstractmethod
    async def get_item(self, item_id: int) -> Optional[ItineraryItem]:
        """Get itinerary item by id."""
        pass

    @abstractmethod
    async def update_item(self, item: ItineraryItem) -> Optional[ItineraryItem]:
        """Update an itinerary item."""
        pass

    @abstractmethod
    async def delete_item(self, item_id: int) -> bool:
        """Delete itinerary item by id."""
        pass

    @abstractmethod
    async def create_incident(self, incident: Incident) -> Incident:
        """Create incident."""
        pass

    @abstractmethod
    async def list_incidents(self, trip_id: int) -> list[Incident]:
        """List incidents by trip."""
        pass

    @abstractmethod
    async def get_incident(self, incident_id: int) -> Optional[Incident]:
        """Get incident by id."""
        pass

    @abstractmethod
    async def create_replan_session(
        self,
        session: ReplanSession,
        items: Optional[list[ReplanItem]] = None,
    ) -> ReplanAggregate:
        """Create replan session with optional items."""
        pass

    @abstractmethod
    async def get_replan_aggregate(self, session_id: int) -> Optional[ReplanAggregate]:
        """Get replan session aggregate by id."""
        pass

    @abstractmethod
    async def create_ai_plan_generation(self, generation: AiPlanGeneration) -> AiPlanGeneration:
        """Create AI plan generation job metadata."""
        pass

    @abstractmethod
    async def get_ai_plan_generation(self, generation_id: int) -> Optional[AiPlanGeneration]:
        """Get AI plan generation by id."""
        pass

    @abstractmethod
    async def update_ai_plan_generation(self, generation: AiPlanGeneration) -> Optional[AiPlanGeneration]:
        """Update AI plan generation status and metadata."""
        pass

    @abstractmethod
    async def list_days_by_trip(self, trip_id: int) -> list[TripDay]:
        """List days by trip."""
        pass

    @abstractmethod
    async def delete_items_by_trip(self, trip_id: int) -> int:
        """Delete itinerary items under all days in the trip."""
        pass

    @abstractmethod
    async def replace_items_by_trip(self, trip_id: int, items: list[ItineraryItem]) -> int:
        """Replace all itinerary items under the trip in one transaction."""
        pass
