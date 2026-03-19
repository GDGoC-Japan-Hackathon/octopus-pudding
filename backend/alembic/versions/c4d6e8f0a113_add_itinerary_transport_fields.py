"""add itinerary transport fields

Revision ID: c4d6e8f0a113
Revises: b2f4d6e8a102
Create Date: 2026-03-19 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "c4d6e8f0a113"
down_revision = "b2f4d6e8a102"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("itinerary_items", sa.Column("item_type", sa.String(length=50), nullable=True))
    op.add_column("itinerary_items", sa.Column("transport_mode", sa.String(length=50), nullable=True))
    op.add_column("itinerary_items", sa.Column("travel_minutes", sa.Integer(), nullable=True))
    op.add_column("itinerary_items", sa.Column("distance_meters", sa.Integer(), nullable=True))
    op.add_column("itinerary_items", sa.Column("from_name", sa.String(length=255), nullable=True))
    op.add_column("itinerary_items", sa.Column("to_name", sa.String(length=255), nullable=True))
    op.execute("UPDATE itinerary_items SET item_type = 'place' WHERE item_type IS NULL")
    op.alter_column("itinerary_items", "item_type", nullable=False)


def downgrade() -> None:
    op.drop_column("itinerary_items", "to_name")
    op.drop_column("itinerary_items", "from_name")
    op.drop_column("itinerary_items", "distance_meters")
    op.drop_column("itinerary_items", "travel_minutes")
    op.drop_column("itinerary_items", "transport_mode")
    op.drop_column("itinerary_items", "item_type")
