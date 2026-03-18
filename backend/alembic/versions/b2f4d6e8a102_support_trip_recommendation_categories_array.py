"""support trip recommendation categories array

Revision ID: b2f4d6e8a102
Revises: a1c3d5e7f901
Create Date: 2026-03-19 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "b2f4d6e8a102"
down_revision = "a1c3d5e7f901"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "trips",
        sa.Column(
            "recommendation_categories",
            postgresql.ARRAY(sa.String(length=100)),
            nullable=True,
        ),
    )
    op.execute(
        """
        UPDATE trips
        SET recommendation_categories =
          CASE
            WHEN recommendation_category IS NULL OR btrim(recommendation_category) = '' THEN ARRAY[]::varchar[]
            ELSE regexp_split_to_array(recommendation_category, '\\s*,\\s*')
          END
        """
    )
    op.drop_column("trips", "recommendation_category")


def downgrade() -> None:
    op.add_column("trips", sa.Column("recommendation_category", sa.String(length=100), nullable=True))
    op.execute(
        """
        UPDATE trips
        SET recommendation_category =
          CASE
            WHEN recommendation_categories IS NULL OR array_length(recommendation_categories, 1) IS NULL THEN NULL
            ELSE array_to_string(recommendation_categories, ', ')
          END
        """
    )
    op.drop_column("trips", "recommendation_categories")
