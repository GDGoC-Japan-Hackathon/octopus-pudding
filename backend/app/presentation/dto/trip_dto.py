from datetime import date as dt_date
from datetime import datetime
import math
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator, root_validator

from app.domain.entities.trip import TripAtmosphere


class TripPreferenceCreate(BaseModel):
    atmosphere: TripAtmosphere
    companions: Optional[str] = None
    budget: Optional[int] = None
    transport_type: Optional[str] = None
    must_visit_places_text: Optional[str] = None
    additional_request_comment: Optional[str] = None


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
    recommendation_comment: Optional[str] = None
    recommendation_categories: list[str] = Field(default_factory=list)
    save_count: int = 0
    status: Literal["planned", "ongoing", "completed"] = "planned"
    preference: Optional[TripPreferenceCreate] = None

    @model_validator(mode="after")
    def validate_trip_constraints(self) -> "TripCreate":
        if self.participant_count > 10:
            raise ValueError("participant_count must be less than or equal to 10")
        if (self.end_date - self.start_date).days + 1 > 3:
            raise ValueError("trip duration must be less than or equal to 3 days")
        return self


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
    recommendation_comment: Optional[str] = None
    recommendation_categories: Optional[list[str]] = None
    save_count: Optional[int] = None
    status: Optional[Literal["planned", "ongoing", "completed"]] = None


class TripPreferenceUpdate(BaseModel):
    atmosphere: TripAtmosphere
    companions: Optional[str] = None
    budget: Optional[int] = None
    transport_type: Optional[str] = None
    must_visit_places_text: Optional[str] = None
    additional_request_comment: Optional[str] = None


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
    lodging_note: Optional[str] = None


class TripDayUpdate(BaseModel):
    day_number: Optional[int] = None
    date: Optional[dt_date] = None
    lodging_note: Optional[str] = None


class ItineraryItemCreate(BaseModel):
    name: str
    item_type: Literal["place", "transport"] = "place"
    category: Optional[str] = None
    transport_mode: Optional[Literal["car", "train", "bus", "walk", "bicycle", "plane", "ship", "taxi", "other"]] = (
        None
    )
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
    line_name: Optional[str] = None
    vehicle_type: Optional[str] = None
    departure_stop_name: Optional[str] = None
    arrival_stop_name: Optional[str] = None

    @root_validator(skip_on_failure=True)
    def validate_transport_fields(cls, values: dict) -> dict:
        item_type = values.get("item_type")
        if item_type == "transport":
            transport_mode = values.get("transport_mode")
            from_name = values.get("from_name")
            to_name = values.get("to_name")
            missing = [
                field_name
                for field_name, field_value in (
                    ("transport_mode", transport_mode),
                    ("from_name", from_name),
                    ("to_name", to_name),
                )
                if field_value is None
            ]
            if missing:
                raise ValueError(
                    "When item_type is 'transport', the following fields are required "
                    "and must be non-null: " + ", ".join(missing)
                )
        return values


class ItineraryItemUpdate(BaseModel):
    name: Optional[str] = None
    item_type: Optional[Literal["place", "transport"]] = None
    category: Optional[str] = None
    transport_mode: Optional[Literal["car", "train", "bus", "walk", "bicycle", "plane", "ship", "taxi", "other"]] = (
        None
    )
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
    line_name: Optional[str] = None
    vehicle_type: Optional[str] = None
    departure_stop_name: Optional[str] = None
    arrival_stop_name: Optional[str] = None

    @root_validator(skip_on_failure=True)
    def validate_transport_fields_on_update(cls, values: dict) -> dict:
        item_type = values.get("item_type")
        # Only enforce when the update explicitly sets item_type to "transport"
        if item_type == "transport":
            transport_mode = values.get("transport_mode")
            from_name = values.get("from_name")
            to_name = values.get("to_name")
            missing = [
                field_name
                for field_name, field_value in (
                    ("transport_mode", transport_mode),
                    ("from_name", from_name),
                    ("to_name", to_name),
                )
                if field_value is None
            ]
            if missing:
                raise ValueError(
                    "When item_type is updated to 'transport', the following fields "
                    "must also be provided and non-null: " + ", ".join(missing)
                )
        return values


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
    class LocationLatLng(BaseModel):
        latitude: float
        longitude: float

        @field_validator("latitude", "longitude", mode="before")
        @classmethod
        def validate_numeric_type(cls, value):
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise ValueError("latitude/longitude must be numeric")
            return float(value)

        @field_validator("latitude")
        @classmethod
        def validate_latitude(cls, value: float) -> float:
            if not math.isfinite(value) or value < -90 or value > 90:
                raise ValueError("latitude must be between -90 and 90")
            return value

        @field_validator("longitude")
        @classmethod
        def validate_longitude(cls, value: float) -> float:
            if not math.isfinite(value) or value < -180 or value > 180:
                raise ValueError("longitude must be between -180 and 180")
            return value

    origin: LocationLatLng
    destination: LocationLatLng
    lodging: Optional[LocationLatLng] = None
    provider: Optional[str] = None
    prompt_version: Optional[str] = None
    run_async: bool = True
    must_visit_places: list[str] = Field(default_factory=list)
    lodging_notes: list[str] = Field(default_factory=list)
    additional_request_comment: Optional[str] = None
    selected_companion_names: list[str] = Field(default_factory=list)


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
    recommendation_comment: Optional[str] = None
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
    must_visit_places_text: Optional[str] = None
    additional_request_comment: Optional[str] = None
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
    lodging_note: Optional[str] = None
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
    line_name: Optional[str] = None
    vehicle_type: Optional[str] = None
    departure_stop_name: Optional[str] = None
    arrival_stop_name: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TripAggregateResponse(BaseModel):
    trip: TripResponse
    preference: Optional[TripPreferenceResponse] = None
    members: list[TripMemberResponse]
    days: list[TripDayResponse]
    itinerary_items: list[ItineraryItemResponse]
