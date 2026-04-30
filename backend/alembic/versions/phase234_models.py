"""phase234_models — Phase 2.2~3.4 新增模型补全

新增表：
  - delivery_packages (Phase 1.2 遗漏)
  - script_parse_reports (Phase 2.2)
  - shot_import_reports (Phase 2.2)
  - script_issues (Phase 2.2)
  - props (Phase 2.3)
  - prop_states (Phase 2.3)
  - prompt_templates (Phase 2.3)
  - still_candidates (Phase 2.4a)
  - complexity_profiles (Phase 3.2)
  - cost_records (Phase 3.4)

新增列：
  - scenes.locked_still_id

Revision ID: phase234_models
Revises: 5a07f43b11e5
Create Date: 2026-04-30 11:45:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "phase234_models"
down_revision: Union[str, None] = "5a07f43b11e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. delivery_packages (Phase 1.2 遗漏) ──
    op.create_table(
        "delivery_packages",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("project_id", sa.String(32), sa.ForeignKey("projects.id", ondelete="SET NULL"), nullable=True),
        sa.Column("episode_id", sa.String(32), sa.ForeignKey("episodes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("publish_job_id", sa.String(32), sa.ForeignKey("publish_jobs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("package_no", sa.Integer(), nullable=False, comment="包序号"),
        sa.Column("status", sa.String(32), nullable=False, server_default="BUILDING"),
        sa.Column("total_size", sa.Integer(), nullable=True),
        sa.Column("asset_count", sa.Integer(), server_default="0"),
        sa.Column("checksum", sa.String(64), nullable=True),
        sa.Column("manifest_json", sa.JSON(), nullable=True),
        sa.Column("built_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── 2. script_parse_reports (Phase 2.2) ──
    op.create_table(
        "script_parse_reports",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("episode_id", sa.String(32), sa.ForeignKey("episodes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("total_shots", sa.Integer(), server_default="0"),
        sa.Column("parsed_shots", sa.Integer(), server_default="0"),
        sa.Column("failed_shots", sa.Integer(), server_default="0"),
        sa.Column("parse_method", sa.String(32), server_default="rule"),
        sa.Column("raw_issues", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(32), server_default="completed"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── 3. shot_import_reports (Phase 2.2) ──
    op.create_table(
        "shot_import_reports",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("parse_report_id", sa.String(32), sa.ForeignKey("script_parse_reports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("scene_id", sa.String(32), nullable=True),
        sa.Column("shot_no", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(256), nullable=True),
        sa.Column("location_name", sa.String(256), nullable=True),
        sa.Column("character_names", sa.JSON(), nullable=True),
        sa.Column("dialogue", sa.Text(), nullable=True),
        sa.Column("action", sa.Text(), nullable=True),
        sa.Column("estimated_duration", sa.Float(), nullable=True),
        sa.Column("prop_hints", sa.JSON(), nullable=True),
        sa.Column("import_status", sa.String(32), server_default="success"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── 4. script_issues (Phase 2.2) ──
    op.create_table(
        "script_issues",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("parse_report_id", sa.String(32), sa.ForeignKey("script_parse_reports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("issue_type", sa.String(32), nullable=True),
        sa.Column("severity", sa.String(16), server_default="warning"),
        sa.Column("line_number", sa.Integer(), nullable=True),
        sa.Column("original_text", sa.Text(), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("suggested_fix", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── 5. props (Phase 2.3) ──
    op.create_table(
        "props",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("project_id", sa.String(32), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(64), nullable=True),
        sa.Column("reference_asset_id", sa.String(32), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── 6. prop_states (Phase 2.3) ──
    op.create_table(
        "prop_states",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("prop_id", sa.String(32), sa.ForeignKey("props.id", ondelete="CASCADE"), nullable=False),
        sa.Column("scene_id", sa.String(32), sa.ForeignKey("scenes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("state_description", sa.Text(), nullable=True),
        sa.Column("visual_notes", sa.Text(), nullable=True),
        sa.Column("changed_from_state_id", sa.String(32), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── 7. prompt_templates (Phase 2.3) ──
    op.create_table(
        "prompt_templates",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("project_id", sa.String(32), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("category", sa.String(64), server_default="general"),
        sa.Column("template_text", sa.Text(), nullable=True),
        sa.Column("version", sa.Integer(), server_default="1"),
        sa.Column("is_default", sa.Boolean(), server_default="0"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── 8. still_candidates (Phase 2.4a) ──
    op.create_table(
        "still_candidates",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("scene_id", sa.String(32), sa.ForeignKey("scenes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version", sa.Integer(), server_default="1"),
        sa.Column("image_path", sa.String(512), nullable=False),
        sa.Column("thumbnail_path", sa.String(512), nullable=True),
        sa.Column("prompt_used", sa.Text(), nullable=True),
        sa.Column("seed", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(16), server_default="pending"),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column("reviewed_by", sa.String(64), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── 9. complexity_profiles (Phase 3.2) ──
    op.create_table(
        "complexity_profiles",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("scene_id", sa.String(32), sa.ForeignKey("scenes.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("overall_score", sa.Float(), nullable=False),
        sa.Column("character_count", sa.Integer(), server_default="0"),
        sa.Column("has_location", sa.Boolean(), server_default="0"),
        sa.Column("duration_score", sa.Float(), server_default="0"),
        sa.Column("character_score", sa.Float(), server_default="0"),
        sa.Column("action_score", sa.Float(), server_default="0"),
        sa.Column("style_score", sa.Float(), server_default="0"),
        sa.Column("breakdown", sa.Text(), nullable=True),
        sa.Column("calculated_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── 10. cost_records (Phase 3.4) ──
    op.create_table(
        "cost_records",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("project_id", sa.String(32), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("scene_id", sa.String(32), sa.ForeignKey("scenes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("scene_version_id", sa.String(32), nullable=True),
        sa.Column("job_id", sa.String(32), nullable=True),
        sa.Column("cost_type", sa.String(32), nullable=False),
        sa.Column("provider", sa.String(64), nullable=True),
        sa.Column("model", sa.String(64), nullable=True),
        sa.Column("input_tokens", sa.Integer(), nullable=True),
        sa.Column("output_tokens", sa.Integer(), nullable=True),
        sa.Column("duration_seconds", sa.Float(), nullable=True),
        sa.Column("api_calls", sa.Integer(), server_default="1"),
        sa.Column("retry_count", sa.Integer(), server_default="0"),
        sa.Column("cost_usd", sa.Float(), server_default="0.0"),
        sa.Column("estimated_cost_usd", sa.Float(), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── 11. scenes.locked_still_id (Phase 2.4a) ──
    with op.batch_alter_table("scenes") as batch:
        batch.add_column(
            sa.Column("locked_still_id", sa.String(32), nullable=True, comment="锁定的静帧候选 ID")
        )


def downgrade() -> None:
    with op.batch_alter_table("scenes") as batch:
        batch.drop_column("locked_still_id")

    op.drop_table("cost_records")
    op.drop_table("complexity_profiles")
    op.drop_table("still_candidates")
    op.drop_table("prompt_templates")
    op.drop_table("prop_states")
    op.drop_table("props")
    op.drop_table("script_issues")
    op.drop_table("shot_import_reports")
    op.drop_table("script_parse_reports")
    op.drop_table("delivery_packages")
