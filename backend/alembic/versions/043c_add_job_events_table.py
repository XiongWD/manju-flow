"""043c: add job_events table for progress event persistence

Revision ID: 043c_add_job_events
Revises: 041b3_feedback
Create Date: 2026-04-30 10:40:00
"""
from alembic import op
import sqlalchemy as sa

revision = "043c_add_job_events"
down_revision = "9646a84d609a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "job_events",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("job_id", sa.String(32), nullable=False, index=True),
        sa.Column("event_type", sa.String(32), server_default="progress", nullable=True),
        sa.Column("step_key", sa.String(64), nullable=True),
        sa.Column("job_status", sa.String(32), nullable=True),
        sa.Column("step_status", sa.String(32), nullable=True),
        sa.Column("progress_percent", sa.Integer(), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("payload_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("job_events")
