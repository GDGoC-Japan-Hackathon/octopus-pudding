# Repository interfaces

from app.domain.repositories.trip_repository import TripRepository
from app.domain.repositories.user_repository import UserRepository
from app.domain.repositories.friend_repository import FriendRepository

__all__ = [
    "UserRepository",
    "TripRepository",
    "FriendRepository",
]
