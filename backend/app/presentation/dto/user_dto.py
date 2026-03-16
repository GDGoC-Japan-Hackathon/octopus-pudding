from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional


class UserBase(BaseModel):
    email: EmailStr
    username: str


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    username: Optional[str] = None
    profile_image_url: Optional[str] = None
    nearest_station: Optional[str] = None

    model_config = {"extra": "forbid"}


class UserResponse(UserBase):
    id: int
    firebase_uid: Optional[str] = None
    profile_image_url: Optional[str] = None
    nearest_station: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    model_config = {"from_attributes": True} 


class ProfileImageUrlResponse(BaseModel):
    signed_url: str
    expires_in_seconds: int
