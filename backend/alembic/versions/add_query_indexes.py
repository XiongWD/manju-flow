"""add_query_indexes

Phase 3.1: 为高频查询字段补齐数据库索引
"""

from alembic import op

revision = "add_query_indexes"
down_revision = "auth_users_table"
branch_labels = None
depends_on = None

# ── 所有需要创建的索引 ──────────────────────────────────────────────
# (table, col, index_name)
INDEXES = [
    ("episodes", "project_id", "ix_episodes_project_id"),
    ("scenes", "episode_id", "ix_scenes_episode_id"),
    ("scenes", "location_id", "ix_scenes_location_id"),
    ("scenes", "locked_still_id", "ix_scenes_locked_still_id"),
    ("characters", "project_id", "ix_characters_project_id"),
    ("assets", "project_id", "ix_assets_project_id"),
    ("asset_links", "asset_id", "ix_asset_links_asset_id"),
    ("asset_links", "owner_id", "ix_asset_links_owner_id"),
    ("jobs", "project_id", "ix_jobs_project_id"),
    ("jobs", "target_id", "ix_jobs_target_id"),
    ("qa_runs", "subject_id", "ix_qa_runs_subject_id"),
    ("publish_jobs", "project_id", "ix_publish_jobs_project_id"),
    ("delivery_packages", "episode_id", "ix_delivery_packages_episode_id"),
    ("story_bibles", "project_id", "ix_story_bibles_project_id"),
    ("project_configs", "project_id", "ix_project_configs_project_id"),
    ("character_episodes", "episode_id", "ix_character_episodes_episode_id"),
    ("scene_characters", "scene_id", "ix_scene_characters_scene_id"),
    ("still_candidates", "scene_id", "ix_still_candidates_scene_id"),
    ("cost_records", "project_id", "ix_cost_records_project_id"),
    ("knowledge_items", "project_id", "ix_knowledge_items_project_id"),
    ("props", "project_id", "ix_props_project_id"),
    ("prompt_templates", "project_id", "ix_prompt_templates_project_id"),
]


def upgrade() -> None:
    for table, col, idx_name in INDEXES:
        try:
            op.create_index(idx_name, table, [col])
        except Exception:
            # SQLite / 已存在索引时忽略
            pass


def downgrade() -> None:
    for table, col, idx_name in INDEXES:
        try:
            op.drop_index(idx_name, table_name=table)
        except Exception:
            pass
