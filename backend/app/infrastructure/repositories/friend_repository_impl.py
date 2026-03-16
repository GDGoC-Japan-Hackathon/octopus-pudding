from typing import Optional

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.domain.entities.friend import (
    AcceptedFriend,
    Friend,
    FriendRequestDetail,
    FriendUserSummary,
)
from app.domain.repositories.friend_repository import FriendRepository
from app.infrastructure.database.models import FriendModel, UserModel


class FriendRepositoryImpl(FriendRepository):
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_request(self, request: Friend) -> Friend:
        db_request = FriendModel(
            requester_user_id=request.requester_user_id,
            addressee_user_id=request.addressee_user_id,
            status=request.status,
        )
        self.db.add(db_request)
        await self.db.commit()
        await self.db.refresh(db_request)
        return self._to_entity(db_request)

    async def get_by_id(self, request_id: int) -> Optional[Friend]:
        result = await self.db.execute(select(FriendModel).where(FriendModel.id == request_id))
        db_request = result.scalar_one_or_none()
        return self._to_entity(db_request) if db_request else None

    async def find_between_users(self, user_a_id: int, user_b_id: int) -> Optional[Friend]:
        result = await self.db.execute(
            select(FriendModel).where(
                or_(
                    and_(
                        FriendModel.requester_user_id == user_a_id,
                        FriendModel.addressee_user_id == user_b_id,
                    ),
                    and_(
                        FriendModel.requester_user_id == user_b_id,
                        FriendModel.addressee_user_id == user_a_id,
                    ),
                )
            )
        )
        db_request = result.scalar_one_or_none()
        return self._to_entity(db_request) if db_request else None

    async def list_incoming_requests(self, user_id: int) -> list[FriendRequestDetail]:
        requester_alias = aliased(UserModel)
        addressee_alias = aliased(UserModel)
        stmt = (
            select(FriendModel, requester_alias, addressee_alias)
            .join(requester_alias, requester_alias.id == FriendModel.requester_user_id)
            .join(addressee_alias, addressee_alias.id == FriendModel.addressee_user_id)
            .where(FriendModel.addressee_user_id == user_id)
            .order_by(FriendModel.created_at.desc())
        )
        result = await self.db.execute(stmt)
        rows = result.all()
        return [
            FriendRequestDetail(
                request=self._to_entity(request),
                requester=self._to_user_summary(requester),
                addressee=self._to_user_summary(addressee),
            )
            for request, requester, addressee in rows
        ]

    async def list_outgoing_requests(self, user_id: int) -> list[FriendRequestDetail]:
        requester_alias = aliased(UserModel)
        addressee_alias = aliased(UserModel)
        stmt = (
            select(FriendModel, requester_alias, addressee_alias)
            .join(requester_alias, requester_alias.id == FriendModel.requester_user_id)
            .join(addressee_alias, addressee_alias.id == FriendModel.addressee_user_id)
            .where(FriendModel.requester_user_id == user_id)
            .order_by(FriendModel.created_at.desc())
        )
        result = await self.db.execute(stmt)
        rows = result.all()
        return [
            FriendRequestDetail(
                request=self._to_entity(request),
                requester=self._to_user_summary(requester),
                addressee=self._to_user_summary(addressee),
            )
            for request, requester, addressee in rows
        ]

    async def update_status(self, request_id: int, status: str) -> Optional[Friend]:
        result = await self.db.execute(select(FriendModel).where(FriendModel.id == request_id))
        db_request = result.scalar_one_or_none()
        if not db_request:
            return None

        db_request.status = status
        await self.db.commit()
        await self.db.refresh(db_request)
        return self._to_entity(db_request)

    async def list_accepted_friends(self, user_id: int) -> list[AcceptedFriend]:
        requester_alias = aliased(UserModel)
        addressee_alias = aliased(UserModel)
        stmt = (
            select(FriendModel, requester_alias, addressee_alias)
            .join(requester_alias, requester_alias.id == FriendModel.requester_user_id)
            .join(addressee_alias, addressee_alias.id == FriendModel.addressee_user_id)
            .where(
                FriendModel.status == "accepted",
                or_(
                    FriendModel.requester_user_id == user_id,
                    FriendModel.addressee_user_id == user_id,
                ),
            )
            .order_by(FriendModel.updated_at.desc())
        )
        result = await self.db.execute(stmt)
        rows = result.all()

        accepted_friends: list[AcceptedFriend] = []
        for request, requester, addressee in rows:
            friend_user = addressee if request.requester_user_id == user_id else requester
            accepted_friends.append(
                AcceptedFriend(
                    request_id=request.id,
                    friend_user=self._to_user_summary(friend_user),
                    created_at=request.created_at,
                    updated_at=request.updated_at,
                )
            )
        return accepted_friends

    async def delete_accepted_between_users(self, user_a_id: int, user_b_id: int) -> bool:
        result = await self.db.execute(
            select(FriendModel).where(
                FriendModel.status == "accepted",
                or_(
                    and_(
                        FriendModel.requester_user_id == user_a_id,
                        FriendModel.addressee_user_id == user_b_id,
                    ),
                    and_(
                        FriendModel.requester_user_id == user_b_id,
                        FriendModel.addressee_user_id == user_a_id,
                    ),
                ),
            )
        )
        db_request = result.scalar_one_or_none()
        if not db_request:
            return False

        await self.db.delete(db_request)
        await self.db.commit()
        return True

    def _to_entity(self, db_request: FriendModel) -> Friend:
        return Friend(
            id=db_request.id,
            requester_user_id=db_request.requester_user_id,
            addressee_user_id=db_request.addressee_user_id,
            status=db_request.status,
            created_at=db_request.created_at,
            updated_at=db_request.updated_at,
        )

    def _to_user_summary(self, db_user: UserModel) -> FriendUserSummary:
        return FriendUserSummary(
            id=db_user.id,
            email=db_user.email,
            username=db_user.username,
            profile_image_url=db_user.profile_image_url,
            nearest_station=db_user.nearest_station,
        )
