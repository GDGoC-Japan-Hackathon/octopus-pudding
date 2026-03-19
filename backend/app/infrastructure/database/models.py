from enum import Enum

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Boolean,
    ForeignKey,
    Date,
    Enum as SQLEnum,
    UniqueConstraint,
    CheckConstraint,
    Float,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.sql import func
from app.infrastructure.database.base import Base


class UserModel(Base):
    """ユーザーモデル表示"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    firebase_uid = Column(String, unique=True, index=True, nullable=True)
    profile_image_url = Column(String, nullable=True)
    nearest_station = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now()) 
    
    
class TripModel(Base):
    """ユーザーごとの旅行プラン"""
    __tablename__ = "trips"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    origin = Column(String(255), nullable=False)
    destination = Column(String(255), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    participant_count = Column(Integer, nullable=False, default=1)
    source_trip_id = Column(Integer, ForeignKey("trips.id"), nullable=True)
    counts_as_saved_recommendation = Column(Boolean, nullable=False, default=False)
    is_public = Column(Boolean, nullable=False, default=False)
    cover_image_url = Column(String(1000), nullable=True)
    recommendation_categories = Column(ARRAY(String(100)), nullable=True)
    save_count = Column(Integer, nullable=False, default=0)
    status = Column(String(50), default="planned")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True),
                        server_default=func.now(),
                        onupdate=func.now())


class FriendModel(Base):
    """フレンド申請 / 関係情報"""
    __tablename__ = "friends"

    id = Column(Integer, primary_key=True, index=True)
    requester_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    addressee_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    status = Column(String(20), nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        UniqueConstraint(
            "requester_user_id",
            "addressee_user_id",
            name="uq_friends_requester_addressee",
        ),
        CheckConstraint(
            "requester_user_id <> addressee_user_id",
            name="ck_friends_not_self",
        ),
    )
    
    
class TripPreferenceModel(Base):
    """AIに計画してもらうための好みを保存"""
    __tablename__ = "trip_preferences"
    
    class TripAtmosphere(str, Enum):
        RELAXED = "のんびり"
        ACTIVE = "アクティブ"
        GOURMET = "グルメ"
        INSTAGENIC = "映え"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=False)
    atmosphere = Column(
        SQLEnum(TripAtmosphere, name="trip_atmosphere_enum"),
        nullable=False,
        default=TripAtmosphere.RELAXED,
    )
    companions = Column(String(50))  # solo / couple / friends / family
    budget = Column(Integer)
    transport_type = Column(String(50))

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("trip_id", name="uq_trip_preferences_trip_id"),
    )
    

class TripMemberModel(Base):
    """旅行のメンバー情報を保存"""
    __tablename__ = "trip_members"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    # owner / organizer / member
    role = Column(String(50), nullable=False, default="member")
    # invited / joined / declined
    status = Column(String(50), nullable=False, default="joined")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        UniqueConstraint("trip_id", "user_id", name="uq_trip_members_trip_id_user_id"),
    )
    
    
class TripDayModel(Base):
    """旅行の日ごとのモデル"""
    __tablename__ = "trip_days"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=False)
    day_number = Column(Integer, nullable=False)
    date = Column(Date)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("trip_id", "day_number", name="uq_trip_days_trip_id_day_number"),
    )


class ItineraryItemModel(Base):
    """旅程スポット"""
    __tablename__ = "itinerary_items"

    id = Column(Integer, primary_key=True, index=True)
    trip_day_id = Column(Integer, ForeignKey("trip_days.id"), nullable=False)
    name = Column(String(255), nullable=False)
    sequence = Column(Integer, nullable=True)
    item_type = Column(String(50), nullable=False, default="place")
    category = Column(String(100))  # restaurant / sightseeing / hotel
    transport_mode = Column(String(50))
    travel_minutes = Column(Integer)
    distance_meters = Column(Integer)
    from_name = Column(String(255))
    to_name = Column(String(255))
    latitude = Column(Float)
    longitude = Column(Float)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    estimated_cost = Column(Integer)
    notes = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    
class IncidentModel(Base):
    """旅行中のトラブル情報を保存"""
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=False)
    # rain / delay / tired / budget / closed / traffic
    incident_type = Column(String(50))  
    description = Column(Text)
    occurred_at = Column(DateTime)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    
class ReplanSessionModel(Base):
    """AIでのプラン再構築の原因を保存"""
    __tablename__ = "replan_sessions"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=False)
    incident_id = Column(Integer, ForeignKey("incidents.id"))
    reason = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    
class ReplanItemModel(Base):
    """プラン変更時の行く場所を保存"""
    __tablename__ = "replan_items"

    id = Column(Integer, primary_key=True, index=True)
    replan_session_id = Column(Integer,
                               ForeignKey("replan_sessions.id"),
                               nullable=False)
    name = Column(String(255), nullable=False)
    category = Column(String(100))
    latitude = Column(Float)
    longitude = Column(Float)
    start_time = Column(DateTime)
    estimated_cost = Column(Integer)
    replacement_for_item_id = Column(Integer,
                                     ForeignKey("itinerary_items.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AiPlanGenerationModel(Base):
    """AI itinerary generation job metadata."""
    __tablename__ = "ai_plan_generations"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=False)
    status = Column(String(20), nullable=False, default="queued")
    provider = Column(String(100), nullable=True)
    prompt_version = Column(String(50), nullable=True)
    requested_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    result_summary_json = Column(Text, nullable=True)
