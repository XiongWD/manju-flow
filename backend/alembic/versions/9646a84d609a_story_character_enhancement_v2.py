"""story_character_enhancement_v2

Revision ID: 9646a84d609a
Revises: 041b3_feedback
Create Date: 2026-04-29 20:04:56.718276
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '9646a84d609a'
down_revision: Union[str, None] = '041b3_feedback'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # ── 1. character_episodes (may already exist from partial run) ──
    exists = conn.execute(
        sa.text("SELECT name FROM sqlite_master WHERE type='table' AND name='character_episodes'")
    ).scalar()
    if not exists:
        op.create_table('character_episodes',
            sa.Column('character_id', sa.String(length=32), nullable=False),
            sa.Column('episode_id', sa.String(length=32), nullable=False),
            sa.ForeignKeyConstraint(['character_id'], ['characters.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['episode_id'], ['episodes.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('character_id', 'episode_id'),
        )

    # ── 2. scene_characters (missing in original migration) ──
    exists = conn.execute(
        sa.text("SELECT name FROM sqlite_master WHERE type='table' AND name='scene_characters'")
    ).scalar()
    if not exists:
        op.create_table('scene_characters',
            sa.Column('scene_id', sa.String(length=32), nullable=False),
            sa.Column('character_id', sa.String(length=32), nullable=False),
            sa.ForeignKeyConstraint(['scene_id'], ['scenes.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['character_id'], ['characters.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('scene_id', 'character_id'),
        )

    # ── 3. story_bibles: add summary / theme / conflict ──
    cols = [r[1] for r in conn.execute(sa.text("PRAGMA table_info(story_bibles)")).fetchall()]
    if 'summary' not in cols:
        op.add_column('story_bibles', sa.Column('summary', sa.Text(), nullable=True, comment='一句话摘要'))
    if 'theme' not in cols:
        op.add_column('story_bibles', sa.Column('theme', sa.String(length=256), nullable=True, comment='核心主题'))
    if 'conflict' not in cols:
        op.add_column('story_bibles', sa.Column('conflict', sa.Text(), nullable=True, comment='核心冲突'))

    # ── 4. analytics_snapshots: episode_id FK + source + publish_job_id ──
    a_cols = [r[1] for r in conn.execute(sa.text("PRAGMA table_info(analytics_snapshots)")).fetchall()]
    if 'episode_id' not in a_cols:
        with op.batch_alter_table('analytics_snapshots') as batch:
            batch.add_column(sa.Column('episode_id', sa.String(length=32), nullable=True))
            batch.create_foreign_key('fk_analytics_episode', 'episodes', ['episode_id'], ['id'], ondelete='SET NULL')
    # publish_job_id and source were already added in partial run; just need FK
    with op.batch_alter_table('analytics_snapshots') as batch:
        batch.create_foreign_key('fk_analytics_pubjob', 'publish_jobs', ['publish_job_id'], ['id'], ondelete='SET NULL')

    # ── 5. knowledge_items ──
    ki_cols = [r[1] for r in conn.execute(sa.text("PRAGMA table_info(knowledge_items)")).fetchall()]
    with op.batch_alter_table('knowledge_items') as batch:
        if 'episode_id' not in ki_cols:
            batch.add_column(sa.Column('episode_id', sa.String(length=32), nullable=True, comment='关联剧集 ID（041b3）'))
        if 'publish_job_id' not in ki_cols:
            batch.add_column(sa.Column('publish_job_id', sa.String(length=32), nullable=True, comment='关联发布任务 ID（041b3）'))
        if 'analytics_snapshot_id' not in ki_cols:
            batch.add_column(sa.Column('analytics_snapshot_id', sa.String(length=32), nullable=True, comment='来源分析快照 ID（041b3）'))
        if 'confidence' not in ki_cols:
            batch.add_column(sa.Column('confidence', sa.Float(), nullable=True, comment='置信度 0~1（041b3）'))
        if 'is_active' not in ki_cols:
            batch.add_column(sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1', comment='是否生效（041b3）'))
        batch.create_foreign_key('fk_ki_episode', 'episodes', ['episode_id'], ['id'], ondelete='SET NULL')
        batch.create_foreign_key('fk_ki_pubjob', 'publish_jobs', ['publish_job_id'], ['id'], ondelete='SET NULL')

    # ── 6. publish_variants ──
    pv_cols = [r[1] for r in conn.execute(sa.text("PRAGMA table_info(publish_variants)")).fetchall()]
    with op.batch_alter_table('publish_variants') as batch:
        if 'delivery_package_id' not in pv_cols:
            batch.add_column(sa.Column('delivery_package_id', sa.String(length=32), nullable=True, comment='关联交付包 ID'))
        if 'resolution' not in pv_cols:
            batch.add_column(sa.Column('resolution', sa.String(length=32), nullable=True, comment='分辨率'))
        if 'aspect_ratio' not in pv_cols:
            batch.add_column(sa.Column('aspect_ratio', sa.String(length=16), nullable=True, comment='画面比例'))
        if 'bitrate' not in pv_cols:
            batch.add_column(sa.Column('bitrate', sa.String(length=32), nullable=True, comment='码率'))
        if 'file_size' not in pv_cols:
            batch.add_column(sa.Column('file_size', sa.Integer(), nullable=True, comment='文件大小（bytes）'))
        if 'duration' not in pv_cols:
            batch.add_column(sa.Column('duration', sa.Float(), nullable=True, comment='时长（秒）'))
        if 'metadata_json' not in pv_cols:
            batch.add_column(sa.Column('metadata_json', sa.JSON(), nullable=True, comment='变体元数据'))
        batch.create_foreign_key('fk_pv_delivery', 'delivery_packages', ['delivery_package_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    with op.batch_alter_table('publish_variants') as batch:
        batch.drop_constraint('fk_pv_delivery', type_='foreignkey')
        batch.drop_column('metadata_json')
        batch.drop_column('duration')
        batch.drop_column('file_size')
        batch.drop_column('bitrate')
        batch.drop_column('aspect_ratio')
        batch.drop_column('resolution')
        batch.drop_column('delivery_package_id')

    with op.batch_alter_table('knowledge_items') as batch:
        batch.drop_constraint('fk_ki_pubjob', type_='foreignkey')
        batch.drop_constraint('fk_ki_episode', type_='foreignkey')
        batch.drop_column('is_active')
        batch.drop_column('confidence')
        batch.drop_column('analytics_snapshot_id')
        batch.drop_column('publish_job_id')
        batch.drop_column('episode_id')

    with op.batch_alter_table('analytics_snapshots') as batch:
        batch.drop_constraint('fk_analytics_pubjob', type_='foreignkey')
        batch.drop_constraint('fk_analytics_episode', type_='foreignkey')
        batch.drop_column('source')
        batch.drop_column('publish_job_id')
        batch.drop_column('episode_id')

    op.drop_column('story_bibles', 'conflict')
    op.drop_column('story_bibles', 'theme')
    op.drop_column('story_bibles', 'summary')
    op.drop_table('scene_characters')
    op.drop_table('character_episodes')
