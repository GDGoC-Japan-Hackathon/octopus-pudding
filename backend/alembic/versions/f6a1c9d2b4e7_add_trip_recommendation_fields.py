"""add trip recommendation fields

Revision ID: f6a1c9d2b4e7
Revises: e5b7c2a1d9f4
Create Date: 2026-03-17 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f6a1c9d2b4e7"
down_revision: Union[str, None] = "e5b7c2a1d9f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("trips", sa.Column("is_public", sa.Boolean(), nullable=True))
    op.add_column("trips", sa.Column("cover_image_url", sa.String(length=1000), nullable=True))
    op.add_column("trips", sa.Column("recommendation_category", sa.String(length=100), nullable=True))
    op.add_column("trips", sa.Column("like_count", sa.Integer(), nullable=True))
    op.execute("UPDATE trips SET is_public = FALSE WHERE is_public IS NULL")
    op.execute("UPDATE trips SET like_count = 0 WHERE like_count IS NULL")
    op.alter_column("trips", "is_public", nullable=False)
    op.alter_column("trips", "like_count", nullable=False)


def downgrade() -> None:
    op.drop_column("trips", "like_count")
    op.drop_column("trips", "recommendation_category")
    op.drop_column("trips", "cover_image_url")
    op.drop_column("trips", "is_public")
