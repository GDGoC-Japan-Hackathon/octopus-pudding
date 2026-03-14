from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel

from app.domain.entities.trip import TripAtmosphere


class TripPreferenceCreate(BaseModel):
    atmosphere: TripAtmosphere
    companions: Optional[str] = None
    budget: Optional[int] = None
    transport_type: Optional[str] = None


class TripCreate(BaseModel):
    origin: str
    destination: str
    start_date: date
    end_date: date
    status: str = "planned"
    preference: Optional[TripPreferenceCreate] = None


class TripUpdate(BaseModel):
    origin: Optional[str] = None
    destination: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None


class TripResponse(BaseModel):
    id: int
    user_id: int
    origin: str
    destination: str
    start_date: date
    end_date: date
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TripPreferenceResponse(BaseModel):
    id: int
    trip_id: int
    atmosphere: TripAtmosphere
    companions: Optional[str] = None
    budget: Optional[int] = None
    transport_type: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TripMemberResponse(BaseModel):
    id: int
    trip_id: int
    user_id: int
    role: str
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TripDayResponse(BaseModel):
    id: int
    trip_id: int
    day_number: int
    date: Optional[date] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ItineraryItemResponse(BaseModel):
    id: int
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

    model_config = {"from_attributes": True}


class TripAggregateResponse(BaseModel):
    trip: TripResponse
    preference: Optional[TripPreferenceResponse] = None
    members: list[TripMemberResponse]
    days: list[TripDayResponse]
    itinerary_items: list[ItineraryItemResponse]
