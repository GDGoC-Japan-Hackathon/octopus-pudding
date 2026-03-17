"""rename trip like count to save count

Revision ID: f8b2d4c6e1a9
Revises: f6a1c9d2b4e7
Create Date: 2026-03-17 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "f8b2d4c6e1a9"
down_revision: Union[str, None] = "f6a1c9d2b4e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("trips", "like_count", new_column_name="save_count")


def downgrade() -> None:
    op.alter_column("trips", "save_count", new_column_name="like_count")
