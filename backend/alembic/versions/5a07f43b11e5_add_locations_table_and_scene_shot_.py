"""add locations table and scene shot_stage location_id

Revision ID: 5a07f43b11e5
Revises: 043c_add_job_events
Create Date: 2026-04-30 11:18:45.035483
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5a07f43b11e5'
down_revision: Union[str, None] = '043c_add_job_events'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('locations',
    sa.Column('id', sa.String(length=32), nullable=False),
    sa.Column('project_id', sa.String(length=32), nullable=False),
    sa.Column('name', sa.String(length=256), nullable=False, comment='地点名称（如：灵异古铺、现代办公室）'),
    sa.Column('description', sa.Text(), nullable=True, comment='地点描述'),
    sa.Column('visual_style', sa.String(length=256), nullable=True, comment='视觉风格描述'),
    sa.Column('reference_asset_id', sa.String(length=32), nullable=True, comment='参考图资产 ID'),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.add_column('scenes', sa.Column('location_id', sa.String(length=32), nullable=True, comment='关联地点 ID'))
    op.add_column('scenes', sa.Column('shot_stage', sa.String(length=32), nullable=False, server_default='draft', comment='镜头生产阶段：draft/script_parsed/still_generating/still_review/still_locked/video_generating/video_review/video_locked/compose_ready/delivery'))
    op.create_foreign_key('fk_scenes_location_id', 'scenes', 'locations', ['location_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    op.drop_constraint('fk_scenes_location_id', 'scenes', type_='foreignkey')
    op.drop_column('scenes', 'shot_stage')
    op.drop_column('scenes', 'location_id')
    op.drop_table('locations')
