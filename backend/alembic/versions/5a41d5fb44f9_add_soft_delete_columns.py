"""add_soft_delete_columns

Revision ID: 5a41d5fb44f9
Revises: add_query_indexes
Create Date: 2026-05-01 06:16:26.235838

为 5 个核心实体表添加 deleted_at 软删除列：
  projects, episodes, scenes, characters, jobs
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5a41d5fb44f9'
down_revision: Union[str, None] = 'add_query_indexes'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_SOFT_DELETE_TABLES = ('projects', 'episodes', 'scenes', 'characters', 'jobs')


def upgrade() -> None:
    for table in _SOFT_DELETE_TABLES:
        op.add_column(table, sa.Column('deleted_at', sa.DateTime(), nullable=True,
                                       comment='软删除时间戳，NULL 表示未删除'))


def downgrade() -> None:
    for table in _SOFT_DELETE_TABLES:
        op.drop_column(table, 'deleted_at')
