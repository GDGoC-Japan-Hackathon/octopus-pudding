"""add trip generation input persistence fields

Revision ID: a9d3f1b2c7e4
Revises: e7c9a1f2b345
Create Date: 2026-03-20 12:00:00.000000
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "a9d3f1b2c7e4"
down_revision = "e7c9a1f2b345"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("trip_preferences", sa.Column("must_visit_places_text", sa.Text(), nullable=True))
    op.add_column("trip_preferences", sa.Column("additional_request_comment", sa.Text(), nullable=True))
    op.add_column("trip_days", sa.Column("lodging_note", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("trip_days", "lodging_note")
    op.drop_column("trip_preferences", "additional_request_comment")
    op.drop_column("trip_preferences", "must_visit_places_text")
