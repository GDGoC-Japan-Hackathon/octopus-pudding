"""add friends table

Revision ID: c1a7b8d9e2f3
Revises: 9f2a8b7c1d4e
Create Date: 2026-03-16 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c1a7b8d9e2f3"
down_revision = "9f2a8b7c1d4e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "friends",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("requester_user_id", sa.Integer(), nullable=False),
        sa.Column("addressee_user_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.CheckConstraint("requester_user_id <> addressee_user_id", name="ck_friends_not_self"),
        sa.ForeignKeyConstraint(["addressee_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["requester_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "requester_user_id",
            "addressee_user_id",
            name="uq_friends_requester_addressee",
        ),
    )
    op.create_index(op.f("ix_friends_id"), "friends", ["id"], unique=False)
    op.create_index("ix_friends_requester_user_id", "friends", ["requester_user_id"], unique=False)
    op.create_index("ix_friends_addressee_user_id", "friends", ["addressee_user_id"], unique=False)
    op.create_index("ix_friends_status", "friends", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_friends_status", table_name="friends")
    op.drop_index("ix_friends_addressee_user_id", table_name="friends")
    op.drop_index("ix_friends_requester_user_id", table_name="friends")
    op.drop_index(op.f("ix_friends_id"), table_name="friends")
    op.drop_table("friends")
