"""drop hashed_password from users

Revision ID: 0c36f06f0f77
Revises: 3e6f97f830a1
Create Date: 2026-03-15 18:10:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0c36f06f0f77"
down_revision = "3e6f97f830a1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("users", "hashed_password")


def downgrade() -> None:
    op.add_column("users", sa.Column("hashed_password", sa.String(), nullable=False))
