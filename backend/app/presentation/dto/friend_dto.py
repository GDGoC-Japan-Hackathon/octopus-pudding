from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr


class FriendRequestCreate(BaseModel):
    target_user_id: int


class FriendRequestUpdate(BaseModel):
    status: Literal["accepted", "rejected", "blocked"]


class FriendUserResponse(BaseModel):
    id: int
    email: EmailStr
    username: str
    profile_image_url: Optional[str] = None
    nearest_station: Optional[str] = None


class FriendRequestResponse(BaseModel):
    id: int
    requester_user_id: int
    addressee_user_id: int
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    requester: Optional[FriendUserResponse] = None
    addressee: Optional[FriendUserResponse] = None


class FriendResponse(BaseModel):
    request_id: int
    user: FriendUserResponse
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
