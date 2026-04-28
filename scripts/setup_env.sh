#!/usr/bin/env bash
# =============================================================================
# Manju Production OS — 环境安装脚本（幂等，可多次运行）
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_DIR/backend"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

echo "=========================================="
echo "  Manju Production OS — 环境搭建"
echo "=========================================="

# ── 1. Python 3.11+ ──────────────────────────────────────────────────────────
check_python() {
    if command -v python3 &>/dev/null; then
        local ver
        ver=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
        if (( $(echo "$ver >= 3.11" | bc -l) )); then
            info "Python $ver ✓"
            return 0
        else
            warn "Python $ver < 3.11，需要升级"
            return 1
        fi
    else
        warn "未找到 python3"
        return 1
    fi
}

if ! check_python; then
    error "请安装 Python 3.11+（推荐 3.12）"
    error "  Ubuntu: sudo add-apt-repository ppa:deadsnakes/ppo && sudo apt install python3.12 python3.12-venv"
    error "  macOS:  brew install python@3.12"
fi

# ── 2. Node.js 18+ ───────────────────────────────────────────────────────────
check_node() {
    if command -v node &>/dev/null; then
        local ver
        ver=$(node -v | sed 's/^v//' | cut -d. -f1)
        if (( ver >= 18 )); then
            info "Node.js $(node -v) ✓"
            return 0
        else
            warn "Node.js $ver < 18"
            return 1
        fi
    else
        warn "未找到 node"
        return 1
    fi
}

if ! check_node; then
    info "安装 Node.js 22 LTS..."
    if command -v curl &>/dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - 2>/dev/null && \
            sudo apt-get install -y nodejs 2>/dev/null || \
            warn "自动安装失败，请手动安装 Node.js 18+: https://nodejs.org/"
    else
        warn "请手动安装 Node.js 18+: https://nodejs.org/"
    fi
fi

# ── 3. FFmpeg 6.0+ ──────────────────────────────────────────────────────────
check_ffmpeg() {
    if command -v ffmpeg &>/dev/null; then
        local first_line
        first_line=$(ffmpeg -version 2>/dev/null | head -1)
        # Nightly: "ffmpeg version N-XXXXXX-gHASH"
        if echo "$first_line" | grep -q "N-"; then
            info "FFmpeg nightly build ✓"
            return 0
        fi
        local ver
        ver=$(echo "$first_line" | grep -oP 'ffmpeg version \K[0-9]+' || echo "0")
        if (( ver >= 6 )); then
            info "FFmpeg $ver.x ✓"
            return 0
        else
            warn "FFmpeg $ver.x < 6.0"
            return 1
        fi
    else
        warn "未找到 ffmpeg"
        return 1
    fi
}

if ! check_ffmpeg; then
    info "安装 FFmpeg..."
    if sudo -n true 2>/dev/null; then
        sudo apt-get update -qq && sudo apt-get install -y -qq ffmpeg 2>/dev/null && \
            info "FFmpeg 安装完成 ✓" || warn "FFmpeg 安装失败"
    else
        warn "需要 sudo 权限安装 FFmpeg"
        warn "  手动安装: sudo apt-get update && sudo apt-get install -y ffmpeg"
        warn "  或本地安装: https://johnvansickle.com/ffmpeg/"
    fi
fi

# ── 4. c2patool ──────────────────────────────────────────────────────────────
check_c2patool() {
    if command -v c2patool &>/dev/null; then
        info "c2patool $(c2patool --version 2>/dev/null || echo 'installed') ✓"
        return 0
    else
        return 1
    fi
}

if ! check_c2patool; then
    info "安装 c2patool (c2pa)..."
    # 优先使用 cargo（完整 CLI），其次在 venv 中安装 Python 绑定
    if command -v cargo &>/dev/null; then
        cargo install c2patool 2>&1 | tail -3 && info "c2patool CLI 安装完成 ✓" || \
            warn "cargo install 失败"
    elif [ -f "$VENV_DIR/bin/pip" ]; then
        "$VENV_DIR/bin/pip" install -q c2pa-python 2>&1 | tail -3 && info "c2pa-python 安装完成 ✓" || \
            warn "pip install c2pa-python 失败"
    else
        warn "请安装 c2patool: cargo install c2patool 或 pip install c2pa-python"
    fi
fi

# ── 5. Python 虚拟环境 ───────────────────────────────────────────────────────
VENV_DIR="$BACKEND_DIR/.venv"

if [ -d "$VENV_DIR" ]; then
    info "Python 虚拟环境已存在 ✓"
else
    info "创建 Python 虚拟环境..."
    python3 -m venv "$VENV_DIR"
    info "虚拟环境创建完成 ✓"
fi

# ── 6. 安装 Python 依赖 ─────────────────────────────────────────────────────
info "安装 Python 依赖..."

# 先创建 requirements.txt 如果不存在
REQUIREMENTS="$BACKEND_DIR/requirements.txt"
if [ ! -f "$REQUIREMENTS" ]; then
    cat > "$REQUIREMENTS" << 'REQEOF'
# Manju Production OS — Python 依赖
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
sqlalchemy[asyncio]>=2.0.0
aiosqlite>=0.20.0
asyncpg>=0.29.0
pydantic>=2.0.0
pydantic-settings>=2.0.0
python-dotenv>=1.0.0
httpx>=0.27.0
aiofiles>=24.0.0
c2pa-python>=0.25.0
REQEOF
    info "已创建 requirements.txt"
fi

"$VENV_DIR/bin/pip" install -q -r "$REQUIREMENTS" 2>&1 | tail -3
info "Python 依赖安装完成 ✓"

# ── 7. 初始化 SQLite 数据库 ─────────────────────────────────────────────────
DB_FILE="$BACKEND_DIR/manju.db"

if [ -f "$DB_FILE" ]; then
    info "SQLite 数据库已存在 ✓"
else
    info "初始化 SQLite 数据库..."
    # 创建空数据库文件并验证可读写
    "$VENV_DIR/bin/python3" -c "
import sqlite3
conn = sqlite3.connect('$DB_FILE')
cursor = conn.cursor()
# 基础元数据表
cursor.execute('''
    CREATE TABLE IF NOT EXISTS _manju_meta (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
''')
cursor.execute(\"INSERT OR IGNORE INTO _manju_meta (key, value) VALUES ('schema_version', '0.1.0')\")
conn.commit()
conn.close()
print('SQLite 数据库初始化完成')
" 2>&1
    info "SQLite 数据库创建完成: $DB_FILE ✓"
fi

# ── 8. 复制 .env 模板（如果不存在） ──────────────────────────────────────────
ENV_FILE="$BACKEND_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
    if [ -f "$BACKEND_DIR/.env.example" ]; then
        cp "$BACKEND_DIR/.env.example" "$ENV_FILE"
        info "已创建 .env（从 .env.example 复制）"
        warn "请编辑 $ENV_FILE 填入实际 API Keys"
    else
        warn "未找到 .env.example，跳过"
    fi
else
    info ".env 已存在 ✓"
fi

# ── 9. 创建必要目录 ──────────────────────────────────────────────────────────
mkdir -p "$BACKEND_DIR/storage/output"
mkdir -p "$PROJECT_DIR/scripts"
info "目录结构就绪 ✓"

# ── 完成 ─────────────────────────────────────────────────────────────────────
echo ""
echo "=========================================="
echo -e "  ${GREEN}环境搭建完成${NC}"
echo "=========================================="
echo ""
echo "下一步："
echo "  1. 编辑 $BACKEND_DIR/.env 填入 API Keys"
echo "  2. 配置 Vast.ai GPU 实例并填入 COMFYUI_API_URL"
echo "  3. 运行连通性测试:"
echo "     cd $PROJECT_DIR && python3 scripts/test_connectivity.py"
echo ""
