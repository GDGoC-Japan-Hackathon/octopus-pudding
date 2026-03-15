"""add profile fields to users

Revision ID: 9f2a8b7c1d4e
Revises: 0c36f06f0f77
Create Date: 2026-03-16 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "9f2a8b7c1d4e"
down_revision = "0c36f06f0f77"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("profile_image_url", sa.String(), nullable=True))
    op.add_column("users", sa.Column("nearest_station", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "nearest_station")
    op.drop_column("users", "profile_image_url")
