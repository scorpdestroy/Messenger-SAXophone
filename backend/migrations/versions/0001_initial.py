"""Initial messenger schema."""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def timestamps():
    return [
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    ]


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("username", sa.String(32), nullable=False, unique=True),
        sa.Column("email", sa.String(254), nullable=False, unique=True),
        sa.Column("display_name", sa.String(80), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        *timestamps(),
    )
    op.create_table(
        "chats",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_low_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("user_high_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        *timestamps(),
        sa.UniqueConstraint("user_low_id", "user_high_id", name="uq_chat_pair"),
        sa.CheckConstraint("user_low_id < user_high_id", name="ck_chat_pair_order"),
    )
    op.create_table(
        "chat_members",
        sa.Column("chat_id", sa.Uuid(), sa.ForeignKey("chats.id"), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column(
            "joined_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("last_read_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "messages",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("chat_id", sa.Uuid(), sa.ForeignKey("chats.id"), nullable=False),
        sa.Column("sender_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(
            ["chat_id", "sender_id"], ["chat_members.chat_id", "chat_members.user_id"]
        ),
        sa.CheckConstraint("length(trim(body)) BETWEEN 1 AND 4000", name="ck_message_body"),
    )
    op.create_index("ix_message_history", "messages", ["chat_id", "created_at", "id"])


def downgrade():
    op.drop_table("messages")
    op.drop_table("chat_members")
    op.drop_table("chats")
    op.drop_table("users")
