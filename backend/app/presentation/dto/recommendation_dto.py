from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class RecommendationListResponse(BaseModel):
    id: int
    title: str
    start_date: str
    end_date: str
    date_label: str
    participant_count: int
    save_count: int
    is_saved_by_me: bool
    saved_trip_id: Optional[int] = None
    categories: list[str]
    image: str
    created_at: Optional[datetime] = None


class RecommendationTimelineItemResponse(BaseModel):
    id: int
    start: str
    end: str
    title: str
    body: str
    icon: Optional[str] = None


class RecommendationDayResponse(BaseModel):
    key: str
    label: str
    timeline: list[RecommendationTimelineItemResponse]


class RecommendationDetailResponse(BaseModel):
    id: int
    title: str
    image: str
    username: str
    date: str
    area: str
    intro: str
    budget: str
    move_time: str
    is_saved_by_me: bool
    saved_trip_id: Optional[int] = None
    days: list[RecommendationDayResponse]


class RecommendationCloneRequest(BaseModel):
    mode: str = "use"


class RecommendationCloneResponse(BaseModel):
    trip_id: int


class RecommendationConfirmSaveResponse(BaseModel):
    trip_id: int
