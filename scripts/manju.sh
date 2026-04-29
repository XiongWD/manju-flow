#!/usr/bin/env bash
# manju.sh — Manju Production OS 服务管理脚本
# 用法: ./manju.sh {start|stop|restart|status} [backend|frontend|all]
# 默认操作 all

set -uo pipefail

# ── 配置 ──────────────────────────────────────────────
MANJU_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$MANJU_ROOT/backend"
FRONTEND_DIR="$MANJU_ROOT/frontend-next"

BACKEND_PORT=8000
FRONTEND_PORT=3000

BACKEND_PID_FILE="$MANJU_ROOT/.manju-backend.pid"
FRONTEND_PID_FILE="$MANJU_ROOT/.manju-frontend.pid"

LOG_DIR="$MANJU_ROOT/logs"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

# ── 颜色 ──────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { printf "${GREEN}[INFO]${NC} %s\n" "$*"; }
log_warn()  { printf "${YELLOW}[WARN]${NC} %s\n" "$*"; }
log_error() { printf "${RED}[ERROR]${NC} %s\n" "$*"; }

# ── 工具函数 ──────────────────────────────────────────
mkdir -p "$LOG_DIR"

find_pid_on_port() {
    local port=$1
    ss -tlnp 2>/dev/null | grep ":${port} " | grep -oP 'pid=\K[0-9]+' | head -1
}

kill_port() {
    local port=$1 name=$2
    local pid
    pid=$(find_pid_on_port "$port")
    if [[ -n "$pid" ]]; then
        log_warn "$name 端口 $port 被进程 PID=$pid 占用，正在清理..."
        kill "$pid" 2>/dev/null || true
        sleep 0.5
        if kill -0 "$pid" 2>/dev/null; then
            log_warn "进程未响应 SIGTERM，发送 SIGKILL..."
            kill -9 "$pid" 2>/dev/null || true
            sleep 0.5
        fi
        if kill -0 "$pid" 2>/dev/null; then
            log_error "无法清理端口 $port (PID=$pid)，请手动处理"
            return 1
        fi
        log_info "端口 $port 已释放"
    fi
}

is_alive() {
    local pid_file=$1
    [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null
}

# ── Backend (FastAPI :8000) ──────────────────────────
backend_start() {
    if is_alive "$BACKEND_PID_FILE"; then
        log_info "Backend 已在运行 (PID=$(cat "$BACKEND_PID_FILE"))"
        return 0
    fi
    kill_port "$BACKEND_PORT" "Backend"

    log_info "启动 Backend (端口 $BACKEND_PORT)..."
    cd "$BACKEND_DIR"
    if [[ -f "$BACKEND_DIR/.venv/bin/activate" ]]; then
        source "$BACKEND_DIR/.venv/bin/activate"
    elif [[ -f "$BACKEND_DIR/venv/bin/activate" ]]; then
        source "$BACKEND_DIR/venv/bin/activate"
    fi

    nohup python -m uvicorn main:app --host 0.0.0.0 --port "$BACKEND_PORT" \
        >> "$BACKEND_LOG" 2>&1 &
    echo $! > "$BACKEND_PID_FILE"

    sleep 1
    if is_alive "$BACKEND_PID_FILE"; then
        log_info "Backend 启动成功 (PID=$(cat "$BACKEND_PID_FILE"))"
    else
        log_error "Backend 启动失败，查看日志: $BACKEND_LOG"
        return 1
    fi
}

backend_stop() {
    if [[ -f "$BACKEND_PID_FILE" ]]; then
        local pid
        pid=$(cat "$BACKEND_PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            log_info "停止 Backend (PID=$pid)..."
            kill "$pid" 2>/dev/null || true
            sleep 1
            if kill -0 "$pid" 2>/dev/null; then
                kill -9 "$pid" 2>/dev/null || true
            fi
        fi
        rm -f "$BACKEND_PID_FILE"
    fi
    kill_port "$BACKEND_PORT" "Backend"
    log_info "Backend 已停止"
}

backend_status() {
    local pid
    pid=$(find_pid_on_port "$BACKEND_PORT")
    if [[ -n "$pid" ]]; then
        printf "Backend   ${GREEN}● 运行中${NC}  端口=$BACKEND_PORT  PID=$pid\n"
    else
        printf "Backend   ${RED}○ 未运行${NC}\n"
    fi
}

# ── Frontend (Next.js :3000) ────────────────────────
frontend_start() {
    if is_alive "$FRONTEND_PID_FILE"; then
        log_info "Frontend 已在运行 (PID=$(cat "$FRONTEND_PID_FILE"))"
        return 0
    fi
    kill_port "$FRONTEND_PORT" "Frontend"

    log_info "启动 Frontend (端口 $FRONTEND_PORT)..."
    cd "$FRONTEND_DIR"
    nohup npx next dev -H 0.0.0.0 -p "$FRONTEND_PORT" \
        >> "$FRONTEND_LOG" 2>&1 &
    echo $! > "$FRONTEND_PID_FILE"

    sleep 2
    if is_alive "$FRONTEND_PID_FILE"; then
        log_info "Frontend 启动成功 (PID=$(cat "$FRONTEND_PID_FILE"))"
    else
        log_error "Frontend 启动失败，查看日志: $FRONTEND_LOG"
        return 1
    fi
}

frontend_stop() {
    if [[ -f "$FRONTEND_PID_FILE" ]]; then
        local pid
        pid=$(cat "$FRONTEND_PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            log_info "停止 Frontend (PID=$pid)..."
            kill "$pid" 2>/dev/null || true
            sleep 1
            if kill -0 "$pid" 2>/dev/null; then
                kill -9 "$pid" 2>/dev/null || true
            fi
        fi
        rm -f "$FRONTEND_PID_FILE"
    fi
    kill_port "$FRONTEND_PORT" "Frontend"
    log_info "Frontend 已停止"
}

frontend_status() {
    local pid
    pid=$(find_pid_on_port "$FRONTEND_PORT")
    if [[ -n "$pid" ]]; then
        printf "Frontend  ${GREEN}● 运行中${NC}  端口=$FRONTEND_PORT  PID=$pid\n"
    else
        printf "Frontend  ${RED}○ 未运行${NC}\n"
    fi
}

# ── 路由 ──────────────────────────────────────────────
ACTION="${1:-}"
TARGET="${2:-all}"

declare -A START_FN STOP_FN STATUS_FN
START_FN=([backend]=backend_start [frontend]=frontend_start [all]=all_start)
STOP_FN=([backend]=backend_stop [frontend]=frontend_stop [all]=all_stop)
STATUS_FN=([backend]=backend_status [frontend]=frontend_status [all]=all_status)

all_start()  { backend_start; frontend_start; }
all_stop()   { frontend_stop; backend_stop; }
all_status() { backend_status; frontend_status; }

usage() {
    echo "用法: $0 {start|stop|restart|status} [backend|frontend|all]"
    echo ""
    echo "服务:"
    echo "  backend   FastAPI :$BACKEND_PORT"
    echo "  frontend  Next.js :$FRONTEND_PORT"
    echo "  all       全部服务 (默认)"
    exit 1
}

if [[ -z "$ACTION" ]]; then
    usage
fi
if [[ ! "$ACTION" =~ ^(start|stop|restart|status)$ ]]; then
    log_error "未知操作: $ACTION"
    usage
fi
if [[ ! "$TARGET" =~ ^(backend|frontend|all)$ ]]; then
    log_error "未知服务: $TARGET"
    usage
fi

case "$ACTION" in
    start)   ${START_FN[$TARGET]} ;;
    stop)    ${STOP_FN[$TARGET]} ;;
    restart) ${STOP_FN[$TARGET]}; sleep 1; ${START_FN[$TARGET]} ;;
    status)  ${STATUS_FN[$TARGET]} ;;
esac
