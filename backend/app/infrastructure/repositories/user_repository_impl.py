from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.domain.entities.user import User
from app.domain.repositories.user_repository import UserRepository
from app.infrastructure.database.models import UserModel


class UserRepositoryImpl(UserRepository):
    """User repository implementation"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create(self, user: User) -> User:
        """Create a new user"""
        db_user = UserModel(
            email=user.email,
            username=user.username,
            hashed_password=user.hashed_password,
            firebase_uid=user.firebase_uid,
            is_active=user.is_active
        )
        self.db.add(db_user)
        await self.db.commit()
        await self.db.refresh(db_user)
        return self._to_entity(db_user)
    
    async def get_by_id(self, user_id: int) -> Optional[User]:
        """Get user by ID"""
        result = await self.db.execute(select(UserModel).where(UserModel.id == user_id))
        db_user = result.scalar_one_or_none()
        return self._to_entity(db_user) if db_user else None
    
    async def get_by_email(self, email: str) -> Optional[User]:
        """Get user by email"""
        result = await self.db.execute(select(UserModel).where(UserModel.email == email))
        db_user = result.scalar_one_or_none()
        return self._to_entity(db_user) if db_user else None

    async def get_by_firebase_uid(self, firebase_uid: str) -> Optional[User]:
        """Get user by Firebase UID"""
        result = await self.db.execute(
            select(UserModel).where(UserModel.firebase_uid == firebase_uid)
        )
        db_user = result.scalar_one_or_none()
        return self._to_entity(db_user) if db_user else None
    
    async def get_by_username(self, username: str) -> Optional[User]:
        """Get user by username"""
        result = await self.db.execute(select(UserModel).where(UserModel.username == username))
        db_user = result.scalar_one_or_none()
        return self._to_entity(db_user) if db_user else None
    
    async def get_all(self, skip: int = 0, limit: int = 100) -> List[User]:
        """Get all users with pagination"""
        result = await self.db.execute(select(UserModel).offset(skip).limit(limit))
        db_users = result.scalars().all()
        return [self._to_entity(db_user) for db_user in db_users]
    
    async def update(self, user: User) -> User:
        """Update user"""
        result = await self.db.execute(select(UserModel).where(UserModel.id == user.id))
        db_user = result.scalar_one_or_none()
        if not db_user:
            raise ValueError(f"User with ID {user.id} not found")
        
        db_user.email = user.email
        db_user.username = user.username
        db_user.hashed_password = user.hashed_password
        db_user.firebase_uid = user.firebase_uid
        db_user.is_active = user.is_active
        db_user.updated_at = user.updated_at
        
        await self.db.commit()
        await self.db.refresh(db_user)
        return self._to_entity(db_user)
    
    async def delete(self, user_id: int) -> bool:
        """Delete user"""
        result = await self.db.execute(select(UserModel).where(UserModel.id == user_id))
        db_user = result.scalar_one_or_none()
        if not db_user:
            return False
        
        await self.db.delete(db_user)
        await self.db.commit()
        return True
    
    async def exists_by_email(self, email: str) -> bool:
        """Check if user exists by email"""
        result = await self.db.execute(select(UserModel.id).where(UserModel.email == email))
        return result.first() is not None

    async def exists_by_firebase_uid(self, firebase_uid: str) -> bool:
        """Check if user exists by Firebase UID"""
        result = await self.db.execute(
            select(UserModel.id).where(UserModel.firebase_uid == firebase_uid)
        )
        return result.first() is not None
    
    async def exists_by_username(self, username: str) -> bool:
        """Check if user exists by username"""
        result = await self.db.execute(select(UserModel.id).where(UserModel.username == username))
        return result.first() is not None
    
    def _to_entity(self, db_user: UserModel) -> User:
        """Convert SQLAlchemy model to domain entity"""
        return User(
            id=db_user.id,
            email=db_user.email,
            username=db_user.username,
            hashed_password=db_user.hashed_password,
            firebase_uid=db_user.firebase_uid,
            is_active=db_user.is_active,
            created_at=db_user.created_at,
            updated_at=db_user.updated_at
        ) 
