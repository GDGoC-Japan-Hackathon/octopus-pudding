"""add trip source tracking

Revision ID: a1c3d5e7f901
Revises: f8b2d4c6e1a9
Create Date: 2026-03-19 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "a1c3d5e7f901"
down_revision = "f8b2d4c6e1a9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("trips", sa.Column("source_trip_id", sa.Integer(), nullable=True))
    op.add_column(
        "trips",
        sa.Column("counts_as_saved_recommendation", sa.Boolean(), nullable=True),
    )
    op.execute(
        "UPDATE trips SET counts_as_saved_recommendation = FALSE WHERE counts_as_saved_recommendation IS NULL"
    )
    op.alter_column("trips", "counts_as_saved_recommendation", nullable=False)
    op.create_foreign_key(
        "fk_trips_source_trip_id_trips",
        "trips",
        "trips",
        ["source_trip_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_trips_source_trip_id_trips", "trips", type_="foreignkey")
    op.drop_column("trips", "counts_as_saved_recommendation")
    op.drop_column("trips", "source_trip_id")
