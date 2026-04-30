"""auth_users_table — Phase 0.3 用户认证数据模型

新增表：
  - users (认证与权限管理)
"""

from alembic import op
import sqlalchemy as sa

revision = "auth_users_table"
down_revision = "phase234_models"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("email", sa.String(256), nullable=False, comment="登录邮箱"),
        sa.Column("password_hash", sa.String(255), nullable=False, comment="bcrypt 哈希"),
        sa.Column("display_name", sa.String(128), nullable=True, comment="显示名称"),
        sa.Column("role", sa.String(32), nullable=False, server_default="admin", comment="角色: admin/operator/viewer"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1"), comment="是否启用"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("last_login_at", sa.DateTime(), nullable=True, comment="最后登录时间"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
