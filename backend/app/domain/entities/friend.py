from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class Friend:
    id: Optional[int]
    requester_user_id: int
    addressee_user_id: int
    status: str = "pending"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@dataclass
class FriendUserSummary:
    id: int
    email: str
    username: str
    profile_image_url: Optional[str] = None
    nearest_station: Optional[str] = None


@dataclass
class FriendRequestDetail:
    request: Friend
    requester: FriendUserSummary
    addressee: FriendUserSummary


@dataclass
class AcceptedFriend:
    request_id: int
    friend_user: FriendUserSummary
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
