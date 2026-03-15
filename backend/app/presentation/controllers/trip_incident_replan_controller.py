from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.trip_service import TripService
from app.application.services.user_service import UserService
from app.domain.entities.trip import Incident, ReplanItem, ReplanSession
from app.domain.entities.user import User
from app.infrastructure.database.base import get_db
from app.infrastructure.repositories.trip_repository_impl import TripRepositoryImpl
from app.infrastructure.repositories.user_repository_impl import UserRepositoryImpl
from app.presentation.dto.trip_dto import (
    IncidentCreate,
    IncidentResponse,
    ReplanAggregateResponse,
    ReplanCreate,
    ReplanItemResponse,
    ReplanSessionResponse,
)
from app.shared.auth_utils import verify_token
from app.shared.exceptions import (
    IncidentNotFoundError,
    PermissionDeniedError,
    ReplanSessionNotFoundError,
    TripNotFoundError,
)

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def get_user_service(db: AsyncSession = Depends(get_db)) -> UserService:
    user_repository = UserRepositoryImpl(db)
    return UserService(user_repository)


def get_trip_service(db: AsyncSession = Depends(get_db)) -> TripService:
    trip_repository = TripRepositoryImpl(db)
    return TripService(trip_repository)


async def get_current_user_entity(
    token: str = Depends(oauth2_scheme),
    user_service: UserService = Depends(get_user_service),
) -> User:
    email = verify_token(token)
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    user = await user_service.get_user_by_email(email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


def _to_replan_response(aggregate) -> ReplanAggregateResponse:
    return ReplanAggregateResponse(
        session=ReplanSessionResponse.model_validate(aggregate.session),
        items=[ReplanItemResponse.model_validate(item) for item in aggregate.items],
    )


@router.post("/{trip_id}/incidents", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED)
async def create_incident(
    trip_id: int,
    payload: IncidentCreate,
    current_user: User = Depends(get_current_user_entity),
    trip_service: TripService = Depends(get_trip_service),
):
    incident = Incident(
        id=None,
        trip_id=trip_id,
        incident_type=payload.incident_type,
        description=payload.description,
        occurred_at=payload.occurred_at,
    )
    try:
        created = await trip_service.create_my_incident(
            owner_user_id=current_user.id,
            trip_id=trip_id,
            incident=incident,
        )
        return IncidentResponse.model_validate(created)
    except TripNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.get("/{trip_id}/incidents", response_model=list[IncidentResponse])
async def list_incidents(
    trip_id: int,
    current_user: User = Depends(get_current_user_entity),
    trip_service: TripService = Depends(get_trip_service),
):
    try:
        incidents = await trip_service.list_my_incidents(
            owner_user_id=current_user.id,
            trip_id=trip_id,
        )
        return [IncidentResponse.model_validate(incident) for incident in incidents]
    except TripNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.post("/{trip_id}/replans", response_model=ReplanAggregateResponse, status_code=status.HTTP_201_CREATED)
async def create_replan(
    trip_id: int,
    payload: ReplanCreate,
    current_user: User = Depends(get_current_user_entity),
    trip_service: TripService = Depends(get_trip_service),
):
    session = ReplanSession(
        id=None,
        trip_id=trip_id,
        incident_id=payload.incident_id,
        reason=payload.reason,
    )
    items = [
        ReplanItem(
            id=None,
            replan_session_id=0,
            name=item.name,
            category=item.category,
            latitude=item.latitude,
            longitude=item.longitude,
            start_time=item.start_time,
            estimated_cost=item.estimated_cost,
            replacement_for_item_id=item.replacement_for_item_id,
        )
        for item in payload.items
    ]

    try:
        aggregate = await trip_service.create_my_replan_session(
            owner_user_id=current_user.id,
            trip_id=trip_id,
            session=session,
            items=items,
        )
        return _to_replan_response(aggregate)
    except TripNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except IncidentNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.get("/{trip_id}/replans/{session_id}", response_model=ReplanAggregateResponse)
async def get_replan_detail(
    trip_id: int,
    session_id: int,
    current_user: User = Depends(get_current_user_entity),
    trip_service: TripService = Depends(get_trip_service),
):
    try:
        aggregate = await trip_service.get_my_replan_detail(
            owner_user_id=current_user.id,
            trip_id=trip_id,
            session_id=session_id,
        )
        return _to_replan_response(aggregate)
    except TripNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ReplanSessionNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
