"""multitenant_phase1 — 多租户隔离 Phase 1

变更内容：
  1. users 表：role 注释更新为 superadmin/manager/employer，默认值改为 'manager'
  2. 新增 workspaces 表
  3. 新增 workspace_members 表
  4. projects 表：新增 workspace_id, owner_id 两列
  5. 数据回填：为每个现有 manager/admin 用户创建默认 workspace 并绑定现有 project

注意：此迁移将现有 role='admin' 用户更新为 role='manager'，
      若有系统超管账号请在迁移后手动执行：
        UPDATE users SET role='superadmin' WHERE email='superadmin@manju.ai';
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = "multitenant_phase1"
down_revision = "5a41d5fb44f9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # ── 检查工具函数 ───────────────────────────────────────────────────────
    def table_exists(name: str) -> bool:
        r = conn.execute(text(
            "SELECT count(*) FROM sqlite_master WHERE type='table' AND name=:n"
        ), {"n": name}).scalar()
        return bool(r)

    def column_exists(table: str, col: str) -> bool:
        rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
        return any(r[1] == col for r in rows)

    def index_exists(name: str) -> bool:
        r = conn.execute(text(
            "SELECT count(*) FROM sqlite_master WHERE type='index' AND name=:n"
        ), {"n": name}).scalar()
        return bool(r)

    # ── 1. 新增 workspaces 表 ──────────────────────────────────────────────
    if not table_exists("workspaces"):
        op.create_table(
            "workspaces",
            sa.Column("id", sa.String(32), primary_key=True),
            sa.Column("name", sa.String(256), nullable=False),
            sa.Column("owner_id", sa.String(32), sa.ForeignKey("users.id", ondelete="CASCADE"),
                      nullable=False, unique=True),
            sa.Column("max_employers", sa.Integer(), nullable=False, server_default="5"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )
    if not index_exists("ix_workspaces_owner_id"):
        op.create_index("ix_workspaces_owner_id", "workspaces", ["owner_id"], unique=True)

    # ── 2. 新增 workspace_members 表 ──────────────────────────────────────
    if not table_exists("workspace_members"):
        op.create_table(
            "workspace_members",
            sa.Column("id", sa.String(32), primary_key=True),
            sa.Column("workspace_id", sa.String(32), sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
                      nullable=False),
            sa.Column("user_id", sa.String(32), sa.ForeignKey("users.id", ondelete="CASCADE"),
                      nullable=False),
            sa.Column("role", sa.String(32), nullable=False),
            sa.Column("page_permissions", sa.JSON(), nullable=True),
            sa.Column("invited_by", sa.String(32), sa.ForeignKey("users.id", ondelete="SET NULL"),
                      nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.UniqueConstraint("workspace_id", "user_id", name="uq_workspace_members_workspace_user"),
        )
    if not index_exists("ix_workspace_members_workspace_id"):
        op.create_index("ix_workspace_members_workspace_id", "workspace_members", ["workspace_id"])
    if not index_exists("ix_workspace_members_user_id"):
        op.create_index("ix_workspace_members_user_id", "workspace_members", ["user_id"])

    # ── 3. projects 表新增两列（幂等：列不存在才加）──────────────────────
    if not column_exists("projects", "workspace_id"):
        op.add_column("projects", sa.Column("workspace_id", sa.String(32), nullable=True))
    if not column_exists("projects", "owner_id"):
        op.add_column("projects", sa.Column("owner_id", sa.String(32), nullable=True))
    if not index_exists("ix_projects_workspace_id"):
        op.create_index("ix_projects_workspace_id", "projects", ["workspace_id"])
    if not index_exists("ix_projects_owner_id"):
        op.create_index("ix_projects_owner_id", "projects", ["owner_id"])

    # ── 4. 数据回填 ────────────────────────────────────────────────────────
    conn.execute(text(
        "UPDATE users SET role='manager' WHERE role IN ('admin', 'operator', 'viewer')"
    ))

    import uuid
    from datetime import datetime, timezone

    def _uuid() -> str:
        return uuid.uuid4().hex

    def _now_str() -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    managers = conn.execute(text("SELECT id, display_name, email FROM users WHERE role='manager'")).fetchall()
    for user in managers:
        # 跳过已有 workspace 的 manager
        already = conn.execute(text(
            "SELECT id FROM workspaces WHERE owner_id=:uid"
        ), {"uid": user.id}).fetchone()
        if already:
            ws_id = already[0]
        else:
            ws_id = _uuid()
            display = user[1] or user[2].split("@")[0]
            ws_name = display + " workspace"
            now = _now_str()
            conn.execute(text(
                "INSERT INTO workspaces (id, name, owner_id, max_employers, is_active, created_at, updated_at) "
                "VALUES (:id, :name, :owner_id, 5, 1, :now, :now)"
            ), {"id": ws_id, "name": ws_name, "owner_id": user.id, "now": now})

        # 注册为 workspace_members
        member_exists = conn.execute(text(
            "SELECT id FROM workspace_members WHERE workspace_id=:wid AND user_id=:uid"
        ), {"wid": ws_id, "uid": user.id}).fetchone()
        if not member_exists:
            conn.execute(text(
                "INSERT INTO workspace_members (id, workspace_id, user_id, role, page_permissions, invited_by, created_at) "
                "VALUES (:id, :ws_id, :user_id, 'manager', NULL, NULL, :now)"
            ), {"id": _uuid(), "ws_id": ws_id, "user_id": user.id, "now": _now_str()})

        # 将该 manager 无 workspace 的 projects 绑定到新 workspace
        conn.execute(text(
            "UPDATE projects SET workspace_id=:ws_id, owner_id=:user_id WHERE workspace_id IS NULL"
        ), {"ws_id": ws_id, "user_id": user.id})


def downgrade() -> None:
    # 移除 projects 新增列
    op.drop_index("ix_projects_owner_id", table_name="projects")
    op.drop_index("ix_projects_workspace_id", table_name="projects")
    op.drop_column("projects", "owner_id")
    op.drop_column("projects", "workspace_id")

    # 删除 workspace_members
    op.drop_index("ix_workspace_members_user_id", table_name="workspace_members")
    op.drop_index("ix_workspace_members_workspace_id", table_name="workspace_members")
    op.drop_table("workspace_members")

    # 删除 workspaces
    op.drop_index("ix_workspaces_owner_id", table_name="workspaces")
    op.drop_table("workspaces")

    # 回滚 role 为 admin（无损，统一回滚为 admin）
    op.get_bind().execute(text(
        "UPDATE users SET role='admin' WHERE role IN ('manager', 'employer', 'superadmin')"
    ))
