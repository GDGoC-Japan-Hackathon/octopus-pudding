from dataclasses import dataclass, field
from datetime import date, datetime
from enum import Enum
from typing import Optional


class TripAtmosphere(str, Enum):
    RELAXED = "のんびり"
    ACTIVE = "アクティブ"
    GOURMET = "グルメ"
    INSTAGENIC = "映え"


@dataclass
class Trip:
    id: Optional[int]
    user_id: int
    origin: str
    destination: str
    start_date: date
    end_date: date
    status: str = "planned"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@dataclass
class TripPreference:
    id: Optional[int]
    trip_id: int
    atmosphere: TripAtmosphere
    companions: Optional[str] = None
    budget: Optional[int] = None
    transport_type: Optional[str] = None
    created_at: Optional[datetime] = None


@dataclass
class TripMember:
    id: Optional[int]
    trip_id: int
    user_id: int
    role: str = "member"
    status: str = "joined"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@dataclass
class TripDay:
    id: Optional[int]
    trip_id: int
    day_number: int
    date: Optional[date] = None
    created_at: Optional[datetime] = None


@dataclass
class ItineraryItem:
    id: Optional[int]
    trip_day_id: int
    name: str
    category: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    estimated_cost: Optional[int] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None


@dataclass
class Incident:
    id: Optional[int]
    trip_id: int
    incident_type: Optional[str] = None
    description: Optional[str] = None
    occurred_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


@dataclass
class ReplanSession:
    id: Optional[int]
    trip_id: int
    incident_id: Optional[int] = None
    reason: Optional[str] = None
    created_at: Optional[datetime] = None


@dataclass
class ReplanItem:
    id: Optional[int]
    replan_session_id: int
    name: str
    category: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    start_time: Optional[datetime] = None
    estimated_cost: Optional[int] = None
    replacement_for_item_id: Optional[int] = None
    created_at: Optional[datetime] = None


@dataclass
class ReplanAggregate:
    session: ReplanSession
    items: list[ReplanItem] = field(default_factory=list)


@dataclass
class TripAggregate:
    trip: Trip
    preference: Optional[TripPreference] = None
    members: list[TripMember] = field(default_factory=list)
    days: list[TripDay] = field(default_factory=list)
    itinerary_items: list[ItineraryItem] = field(default_factory=list)
