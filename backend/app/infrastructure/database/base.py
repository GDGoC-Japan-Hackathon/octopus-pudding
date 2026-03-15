from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base
from app.shared.config import settings

# Database engine
engine = create_async_engine(
    settings.database_url,
    pool_pre_ping=True,
    echo=settings.debug
)

# Session factory
SessionLocal = async_sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Base class for models
Base = declarative_base()


async def get_db():
    """Dependency to get database session"""
    async with SessionLocal() as db:
        yield db
