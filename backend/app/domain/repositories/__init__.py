# Repository interfaces

from app.domain.repositories.trip_repository import TripRepository
from app.domain.repositories.user_repository import UserRepository

__all__ = [
    "UserRepository",
    "TripRepository",
]
