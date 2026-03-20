"""add itinerary route detail fields

Revision ID: e7c9a1f2b345
Revises: d5e7f9a1b214
Create Date: 2026-03-20 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "e7c9a1f2b345"
down_revision = "d5e7f9a1b214"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("itinerary_items", sa.Column("line_name", sa.String(length=255), nullable=True))
    op.add_column("itinerary_items", sa.Column("vehicle_type", sa.String(length=255), nullable=True))
    op.add_column("itinerary_items", sa.Column("departure_stop_name", sa.String(length=255), nullable=True))
    op.add_column("itinerary_items", sa.Column("arrival_stop_name", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("itinerary_items", "arrival_stop_name")
    op.drop_column("itinerary_items", "departure_stop_name")
    op.drop_column("itinerary_items", "vehicle_type")
    op.drop_column("itinerary_items", "line_name")
