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
    Float,
    Text,
)
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
    status = Column(String(50), default="planned")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True),
                        server_default=func.now(),
                        onupdate=func.now())
    
    
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


class ItineraryItemModel(Base):
    """旅程スポット"""
    __tablename__ = "itinerary_items"

    id = Column(Integer, primary_key=True, index=True)
    trip_day_id = Column(Integer, ForeignKey("trip_days.id"), nullable=False)
    name = Column(String(255), nullable=False)
    category = Column(String(100))  # restaurant / sightseeing / hotel
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
