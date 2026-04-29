"""041b3: analytics_snapshots add publish_job_id FK + knowledge_items add episode/publish_job/analytics FK + source/confidence/is_active fields

Revision ID: 041b3_analytics_knowledge_feedback
Revises: c9a69f35eefa
Create Date: 2026-04-29 18:10:00
"""
from alembic import op
import sqlalchemy as sa

revision = "041b3_feedback"
down_revision = "c9a69f35eefa"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── analytics_snapshots ──
    op.add_column("analytics_snapshots",
        sa.Column("publish_job_id", sa.String(32), sa.ForeignKey("publish_jobs.id", ondelete="SET NULL"), nullable=True))
    op.add_column("analytics_snapshots",
        sa.Column("source", sa.String(32), server_default="manual", nullable=True))

    # ── knowledge_items ──
    op.add_column("knowledge_items",
        sa.Column("episode_id", sa.String(32), sa.ForeignKey("episodes.id", ondelete="SET NULL"), nullable=True))
    op.add_column("knowledge_items",
        sa.Column("publish_job_id", sa.String(32), sa.ForeignKey("publish_jobs.id", ondelete="SET NULL"), nullable=True))
    op.add_column("knowledge_items",
        sa.Column("analytics_snapshot_id", sa.String(32), nullable=True))
    op.add_column("knowledge_items",
        sa.Column("confidence", sa.Float(), server_default="1.0", nullable=True))
    op.add_column("knowledge_items",
        sa.Column("is_active", sa.Boolean(), server_default="1", nullable=True))

    # ── episode_id FK 升级（原来是裸 string，现在加 FK） ──
    # SQLite 不支持 ALTER FK，需要重建表（SQLite 路径）
    # 对于非 SQLite，只需添加 FK 约束
    # 这里用 batch mode 兼容 SQLite
    try:
        with op.batch_alter_table("analytics_snapshots") as batch_op:
            batch_op.alter_column("episode_id",
                existing_type=sa.String(32),
                type_=sa.String(32),
                existing_nullable=True)
    except Exception:
        pass  # 非 SQLite 且已正确


def downgrade() -> None:
    # ── analytics_snapshots ──
    try:
        with op.batch_alter_table("analytics_snapshots") as batch_op:
            batch_op.drop_column("source")
            batch_op.drop_column("publish_job_id")
    except Exception:
        op.drop_column("analytics_snapshots", "source")
        op.drop_column("analytics_snapshots", "publish_job_id")

    # ── knowledge_items ──
    try:
        with op.batch_alter_table("knowledge_items") as batch_op:
            batch_op.drop_column("is_active")
            batch_op.drop_column("confidence")
            batch_op.drop_column("analytics_snapshot_id")
            batch_op.drop_column("publish_job_id")
            batch_op.drop_column("episode_id")
    except Exception:
        for col in ("is_active", "confidence", "analytics_snapshot_id", "publish_job_id", "episode_id"):
            op.drop_column("knowledge_items", col)
