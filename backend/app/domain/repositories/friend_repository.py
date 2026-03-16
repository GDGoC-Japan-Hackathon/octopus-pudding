from abc import ABC, abstractmethod
from typing import Optional

from app.domain.entities.friend import AcceptedFriend, Friend, FriendRequestDetail


class FriendRepository(ABC):
    @abstractmethod
    async def create_request(self, request: Friend) -> Friend:
        pass

    @abstractmethod
    async def get_by_id(self, request_id: int) -> Optional[Friend]:
        pass

    @abstractmethod
    async def find_between_users(self, user_a_id: int, user_b_id: int) -> Optional[Friend]:
        pass

    @abstractmethod
    async def list_incoming_requests(self, user_id: int) -> list[FriendRequestDetail]:
        pass

    @abstractmethod
    async def list_outgoing_requests(self, user_id: int) -> list[FriendRequestDetail]:
        pass

    @abstractmethod
    async def update_status(self, request_id: int, status: str) -> Optional[Friend]:
        pass

    @abstractmethod
    async def list_accepted_friends(self, user_id: int) -> list[AcceptedFriend]:
        pass

    @abstractmethod
    async def delete_accepted_between_users(self, user_a_id: int, user_b_id: int) -> bool:
        pass
