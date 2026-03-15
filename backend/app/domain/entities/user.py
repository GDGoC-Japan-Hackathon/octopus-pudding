from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class User:
    """User domain entity"""
    id: Optional[int]
    email: str
    username: str
    firebase_uid: Optional[str] = None
    profile_image_url: Optional[str] = None
    nearest_station: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow()
        if self.updated_at is None:
            self.updated_at = datetime.utcnow()

    def update(self, **kwargs):
        """Update user attributes"""
        for key, value in kwargs.items():
            if hasattr(self, key):
                setattr(self, key, value)
        self.updated_at = datetime.utcnow()
