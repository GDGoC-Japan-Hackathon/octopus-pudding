from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.friend_service import FriendService
from app.domain.entities.friend import AcceptedFriend, Friend, FriendRequestDetail, FriendUserSummary
from app.domain.entities.user import User
from app.infrastructure.database.base import get_db
from app.infrastructure.repositories.friend_repository_impl import FriendRepositoryImpl
from app.infrastructure.repositories.user_repository_impl import UserRepositoryImpl
from app.presentation.dependencies.auth import get_current_user
from app.presentation.dto.friend_dto import (
    FriendRequestCreate,
    FriendRequestResponse,
    FriendRequestUpdate,
    FriendResponse,
    FriendUserResponse,
)
from app.shared.exceptions import (
    FriendNotFoundError,
    FriendRequestNotFoundError,
    PermissionDeniedError,
    UserNotFoundError,
    ValidationError,
)

router = APIRouter()


def get_friend_service(db: AsyncSession = Depends(get_db)) -> FriendService:
    return FriendService(
        friend_repository=FriendRepositoryImpl(db),
        user_repository=UserRepositoryImpl(db),
    )


def _to_user_response(user: FriendUserSummary) -> FriendUserResponse:
    return FriendUserResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        profile_image_url=user.profile_image_url,
        nearest_station=user.nearest_station,
    )


def _to_request_response(detail: FriendRequestDetail) -> FriendRequestResponse:
    return FriendRequestResponse(
        id=detail.request.id,
        requester_user_id=detail.request.requester_user_id,
        addressee_user_id=detail.request.addressee_user_id,
        status=detail.request.status,
        created_at=detail.request.created_at,
        updated_at=detail.request.updated_at,
        requester=_to_user_response(detail.requester),
        addressee=_to_user_response(detail.addressee),
    )


def _to_simple_request_response(request: Friend) -> FriendRequestResponse:
    return FriendRequestResponse(
        id=request.id,
        requester_user_id=request.requester_user_id,
        addressee_user_id=request.addressee_user_id,
        status=request.status,
        created_at=request.created_at,
        updated_at=request.updated_at,
    )


def _to_friend_response(friend: AcceptedFriend) -> FriendResponse:
    return FriendResponse(
        request_id=friend.request_id,
        user=_to_user_response(friend.friend_user),
        created_at=friend.created_at,
        updated_at=friend.updated_at,
    )


@router.post(
    "/me/friends/requests",
    response_model=FriendRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_friend_request(
    payload: FriendRequestCreate,
    current_user: User = Depends(get_current_user),
    friend_service: FriendService = Depends(get_friend_service),
):
    try:
        request = await friend_service.create_request(
            requester_user_id=current_user.id,
            target_user_id=payload.target_user_id,
        )
        return _to_simple_request_response(request)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.get("/me/friends/requests/incoming", response_model=list[FriendRequestResponse])
async def list_incoming_friend_requests(
    current_user: User = Depends(get_current_user),
    friend_service: FriendService = Depends(get_friend_service),
):
    details = await friend_service.list_incoming_requests(current_user.id)
    return [_to_request_response(detail) for detail in details]


@router.get("/me/friends/requests/outgoing", response_model=list[FriendRequestResponse])
async def list_outgoing_friend_requests(
    current_user: User = Depends(get_current_user),
    friend_service: FriendService = Depends(get_friend_service),
):
    details = await friend_service.list_outgoing_requests(current_user.id)
    return [_to_request_response(detail) for detail in details]


@router.patch("/me/friends/requests/{request_id}", response_model=FriendRequestResponse)
async def update_friend_request(
    request_id: int,
    payload: FriendRequestUpdate,
    current_user: User = Depends(get_current_user),
    friend_service: FriendService = Depends(get_friend_service),
):
    try:
        request = await friend_service.update_request_status(
            current_user_id=current_user.id,
            request_id=request_id,
            status=payload.status,
        )
        return _to_simple_request_response(request)
    except FriendRequestNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.get("/me/friends", response_model=list[FriendResponse])
async def list_friends(
    current_user: User = Depends(get_current_user),
    friend_service: FriendService = Depends(get_friend_service),
):
    friends = await friend_service.list_friends(current_user.id)
    return [_to_friend_response(friend) for friend in friends]


@router.delete("/me/friends/{friend_user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_friend(
    friend_user_id: int,
    current_user: User = Depends(get_current_user),
    friend_service: FriendService = Depends(get_friend_service),
):
    try:
        await friend_service.remove_friend(
            user_id=current_user.id,
            friend_user_id=friend_user_id,
        )
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except FriendNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
