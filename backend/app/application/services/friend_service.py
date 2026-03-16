from app.domain.entities.friend import AcceptedFriend, Friend, FriendRequestDetail
from app.domain.repositories.friend_repository import FriendRepository
from app.domain.repositories.user_repository import UserRepository
from app.shared.exceptions import (
    FriendNotFoundError,
    FriendRequestNotFoundError,
    PermissionDeniedError,
    UserNotFoundError,
    ValidationError,
)


class FriendService:
    def __init__(
        self,
        friend_repository: FriendRepository,
        user_repository: UserRepository,
    ):
        self.friend_repository = friend_repository
        self.user_repository = user_repository

    async def create_request(self, requester_user_id: int, target_user_id: int) -> Friend:
        if requester_user_id == target_user_id:
            raise ValidationError("You cannot send a friend request to yourself")

        target_user = await self.user_repository.get_by_id(target_user_id)
        if not target_user:
            raise UserNotFoundError(f"Target user with ID {target_user_id} not found")

        existing = await self.friend_repository.find_between_users(requester_user_id, target_user_id)
        if existing:
            raise ValueError("Friend request already exists between these users")

        return await self.friend_repository.create_request(
            Friend(
                id=None,
                requester_user_id=requester_user_id,
                addressee_user_id=target_user_id,
                status="pending",
            )
        )

    async def list_incoming_requests(self, user_id: int) -> list[FriendRequestDetail]:
        return await self.friend_repository.list_incoming_requests(user_id)

    async def list_outgoing_requests(self, user_id: int) -> list[FriendRequestDetail]:
        return await self.friend_repository.list_outgoing_requests(user_id)

    async def update_request_status(
        self,
        current_user_id: int,
        request_id: int,
        status: str,
    ) -> Friend:
        request = await self.friend_repository.get_by_id(request_id)
        if not request:
            raise FriendRequestNotFoundError(f"Friend request with ID {request_id} not found")

        if request.addressee_user_id != current_user_id:
            raise PermissionDeniedError("You are not allowed to update this friend request")

        if request.status != "pending":
            raise ValueError("Only pending friend requests can be updated")

        updated = await self.friend_repository.update_status(request_id, status)
        if not updated:
            raise FriendRequestNotFoundError(f"Friend request with ID {request_id} not found")
        return updated

    async def list_friends(self, user_id: int) -> list[AcceptedFriend]:
        return await self.friend_repository.list_accepted_friends(user_id)

    async def remove_friend(self, user_id: int, friend_user_id: int) -> bool:
        if user_id == friend_user_id:
            raise ValidationError("You cannot remove yourself from friends")

        target_user = await self.user_repository.get_by_id(friend_user_id)
        if not target_user:
            raise UserNotFoundError(f"Target user with ID {friend_user_id} not found")

        deleted = await self.friend_repository.delete_accepted_between_users(user_id, friend_user_id)
        if not deleted:
            raise FriendNotFoundError(f"Accepted friend relation with user {friend_user_id} not found")
        return True
