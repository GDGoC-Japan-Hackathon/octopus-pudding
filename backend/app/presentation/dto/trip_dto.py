from datetime import date as dt_date, datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.domain.entities.trip import TripAtmosphere


class TripPreferenceCreate(BaseModel):
    atmosphere: TripAtmosphere
    companions: Optional[str] = None
    budget: Optional[int] = None
    transport_type: Optional[str] = None


class TripCreate(BaseModel):
    origin: str
    destination: str
    start_date: dt_date
    end_date: dt_date
    participant_count: int = 1
    source_trip_id: Optional[int] = None
    counts_as_saved_recommendation: bool = False
    is_public: bool = False
    cover_image_url: Optional[str] = None
    recommendation_categories: list[str] = Field(default_factory=list)
    save_count: int = 0
    status: str = "planned"
    preference: Optional[TripPreferenceCreate] = None


class TripUpdate(BaseModel):
    origin: Optional[str] = None
    destination: Optional[str] = None
    start_date: Optional[dt_date] = None
    end_date: Optional[dt_date] = None
    participant_count: Optional[int] = None
    source_trip_id: Optional[int] = None
    counts_as_saved_recommendation: Optional[bool] = None
    is_public: Optional[bool] = None
    cover_image_url: Optional[str] = None
    recommendation_categories: Optional[list[str]] = None
    save_count: Optional[int] = None
    status: Optional[str] = None


class TripPreferenceUpdate(BaseModel):
    atmosphere: TripAtmosphere
    companions: Optional[str] = None
    budget: Optional[int] = None
    transport_type: Optional[str] = None


class TripMemberCreate(BaseModel):
    user_id: int
    role: str = "member"
    status: str = "joined"


class TripMemberUpdate(BaseModel):
    role: Optional[str] = None
    status: Optional[str] = None


class TripDayCreate(BaseModel):
    day_number: int
    date: Optional[dt_date] = None


class TripDayUpdate(BaseModel):
    day_number: Optional[int] = None
    date: Optional[dt_date] = None


class ItineraryItemCreate(BaseModel):
    name: str
    item_type: str = "place"
    category: Optional[str] = None
    transport_mode: Optional[str] = None
    travel_minutes: Optional[int] = None
    distance_meters: Optional[int] = None
    from_name: Optional[str] = None
    to_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    estimated_cost: Optional[int] = None
    notes: Optional[str] = None


class ItineraryItemUpdate(BaseModel):
    name: Optional[str] = None
    item_type: Optional[str] = None
    category: Optional[str] = None
    transport_mode: Optional[str] = None
    travel_minutes: Optional[int] = None
    distance_meters: Optional[int] = None
    from_name: Optional[str] = None
    to_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    estimated_cost: Optional[int] = None
    notes: Optional[str] = None


class IncidentCreate(BaseModel):
    incident_type: Optional[str] = None
    description: Optional[str] = None
    occurred_at: Optional[datetime] = None


class IncidentResponse(BaseModel):
    id: int
    trip_id: int
    incident_type: Optional[str] = None
    description: Optional[str] = None
    occurred_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ReplanItemCreate(BaseModel):
    name: str
    category: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    start_time: Optional[datetime] = None
    estimated_cost: Optional[int] = None
    replacement_for_item_id: Optional[int] = None


class ReplanCreate(BaseModel):
    incident_id: Optional[int] = None
    reason: Optional[str] = None
    items: list[ReplanItemCreate] = Field(default_factory=list)


class ReplanSessionResponse(BaseModel):
    id: int
    trip_id: int
    incident_id: Optional[int] = None
    reason: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ReplanItemResponse(BaseModel):
    id: int
    replan_session_id: int
    name: str
    category: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    start_time: Optional[datetime] = None
    estimated_cost: Optional[int] = None
    replacement_for_item_id: Optional[int] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ReplanAggregateResponse(BaseModel):
    session: ReplanSessionResponse
    items: list[ReplanItemResponse]


class AiPlanGenerationCreate(BaseModel):
    provider: Optional[str] = None
    prompt_version: Optional[str] = None
    run_async: bool = True


class AiPlanGenerationResponse(BaseModel):
    id: int
    trip_id: int
    status: str
    provider: Optional[str] = None
    prompt_version: Optional[str] = None
    requested_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    error_message: Optional[str] = None
    result_summary_json: Optional[str] = None

    model_config = {"from_attributes": True}


class TripResponse(BaseModel):
    id: int
    user_id: int
    origin: str
    destination: str
    start_date: dt_date
    end_date: dt_date
    participant_count: int
    source_trip_id: Optional[int] = None
    counts_as_saved_recommendation: bool
    is_public: bool
    cover_image_url: Optional[str] = None
    recommendation_categories: list[str] = Field(default_factory=list)
    save_count: int
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
    date: Optional[dt_date] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ItineraryItemResponse(BaseModel):
    id: int
    trip_day_id: int
    name: str
    item_type: str = "place"
    category: Optional[str] = None
    transport_mode: Optional[str] = None
    travel_minutes: Optional[int] = None
    distance_meters: Optional[int] = None
    from_name: Optional[str] = None
    to_name: Optional[str] = None
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
