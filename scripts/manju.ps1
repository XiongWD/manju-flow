# manju.ps1 — Manju Production OS 服务管理脚本 (Windows PowerShell)
# 用法: .\manju.ps1 {start|stop|restart|status} [backend|frontend|all]
# 默认操作 all

param(
    [Parameter(Position=0)]
    [ValidateSet("start","stop","restart","status")]
    [string]$Action,

    [Parameter(Position=1)]
    [ValidateSet("backend","frontend","all")]
    [string]$Target = "all"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── 配置 ──────────────────────────────────────────────
$MANJU_ROOT    = (Resolve-Path "$PSScriptRoot\..").Path
$BACKEND_DIR   = "$MANJU_ROOT\backend"
$FRONTEND_DIR  = "$MANJU_ROOT\frontend-next"

$BACKEND_PORT  = 8000
$FRONTEND_PORT = 3000

$BACKEND_PID_FILE  = "$MANJU_ROOT\.manju-backend.pid"
$FRONTEND_PID_FILE = "$MANJU_ROOT\.manju-frontend.pid"

$LOG_DIR       = "$MANJU_ROOT\logs"
$BACKEND_LOG   = "$LOG_DIR\backend.log"
$FRONTEND_LOG  = "$LOG_DIR\frontend.log"

# ── 颜色输出 ──────────────────────────────────────────
function Log-Info  { param($msg) Write-Host "[INFO] $msg"  -ForegroundColor Green }
function Log-Warn  { param($msg) Write-Host "[WARN] $msg"  -ForegroundColor Yellow }
function Log-Error { param($msg) Write-Host "[ERROR] $msg" -ForegroundColor Red }

# ── 工具函数 ──────────────────────────────────────────
if (-not (Test-Path $LOG_DIR)) { New-Item -ItemType Directory -Path $LOG_DIR | Out-Null }

function Find-PidOnPort {
    param([int]$Port)
    $result = netstat -ano 2>$null | Select-String ":$Port\s" | Select-String "LISTENING"
    if ($result) {
        $line = $result[0].Line.Trim() -split '\s+'
        return $line[-1]
    }
    return $null
}

function Kill-Port {
    param([int]$Port, [string]$Name)
    $pid = Find-PidOnPort $Port
    if ($pid) {
        Log-Warn "$Name 端口 $Port 被进程 PID=$pid 占用，正在清理..."
        try {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Start-Sleep -Milliseconds 800
        } catch {}
        if (Get-Process -Id $pid -ErrorAction SilentlyContinue) {
            Log-Error "无法清理端口 $Port (PID=$pid)，请手动处理"
            return $false
        }
        Log-Info "端口 $Port 已释放"
    }
    return $true
}

function Is-Alive {
    param([string]$PidFile)
    if (-not (Test-Path $PidFile)) { return $false }
    $pid = Get-Content $PidFile -ErrorAction SilentlyContinue
    if (-not $pid) { return $false }
    return [bool](Get-Process -Id $pid -ErrorAction SilentlyContinue)
}

# ── Backend (FastAPI :8000) ──────────────────────────
function Backend-Start {
    if (Is-Alive $BACKEND_PID_FILE) {
        $pid = Get-Content $BACKEND_PID_FILE
        Log-Info "Backend 已在运行 (PID=$pid)"
        return
    }
    Kill-Port $BACKEND_PORT "Backend" | Out-Null

    Log-Info "启动 Backend (端口 $BACKEND_PORT)..."

    # 查找 Python 可执行文件（优先使用 venv）
    $python = "python"
    if (Test-Path "$BACKEND_DIR\.venv\Scripts\python.exe") {
        $python = "$BACKEND_DIR\.venv\Scripts\python.exe"
    } elseif (Test-Path "$BACKEND_DIR\venv\Scripts\python.exe") {
        $python = "$BACKEND_DIR\venv\Scripts\python.exe"
    }

    $proc = Start-Process -FilePath $python `
        -ArgumentList "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "$BACKEND_PORT" `
        -WorkingDirectory $BACKEND_DIR `
        -RedirectStandardOutput $BACKEND_LOG `
        -RedirectStandardError  "$BACKEND_LOG.err" `
        -WindowStyle Hidden `
        -PassThru

    $proc.Id | Set-Content $BACKEND_PID_FILE

    Start-Sleep -Seconds 2
    if (Is-Alive $BACKEND_PID_FILE) {
        Log-Info "Backend 启动成功 (PID=$($proc.Id))"
    } else {
        Log-Error "Backend 启动失败，查看日志: $BACKEND_LOG"
    }
}

function Backend-Stop {
    if (Test-Path $BACKEND_PID_FILE) {
        $pid = Get-Content $BACKEND_PID_FILE -ErrorAction SilentlyContinue
        if ($pid -and (Get-Process -Id $pid -ErrorAction SilentlyContinue)) {
            Log-Info "停止 Backend (PID=$pid)..."
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1
        }
        Remove-Item $BACKEND_PID_FILE -Force -ErrorAction SilentlyContinue
    }
    Kill-Port $BACKEND_PORT "Backend" | Out-Null
    Log-Info "Backend 已停止"
}

function Backend-Status {
    $pid = Find-PidOnPort $BACKEND_PORT
    if ($pid) {
        Write-Host "Backend   " -NoNewline
        Write-Host "● 运行中" -ForegroundColor Green -NoNewline
        Write-Host "  端口=$BACKEND_PORT  PID=$pid"
    } else {
        Write-Host "Backend   " -NoNewline
        Write-Host "○ 未运行" -ForegroundColor Red
    }
}

# ── Frontend (Next.js :3000) ─────────────────────────
function Frontend-Start {
    if (Is-Alive $FRONTEND_PID_FILE) {
        $pid = Get-Content $FRONTEND_PID_FILE
        Log-Info "Frontend 已在运行 (PID=$pid)"
        return
    }
    Kill-Port $FRONTEND_PORT "Frontend" | Out-Null

    Log-Info "启动 Frontend (端口 $FRONTEND_PORT)..."

    $proc = Start-Process -FilePath "npx" `
        -ArgumentList "next", "dev", "-H", "0.0.0.0", "-p", "$FRONTEND_PORT" `
        -WorkingDirectory $FRONTEND_DIR `
        -RedirectStandardOutput $FRONTEND_LOG `
        -RedirectStandardError  "$FRONTEND_LOG.err" `
        -WindowStyle Hidden `
        -PassThru

    $proc.Id | Set-Content $FRONTEND_PID_FILE

    Start-Sleep -Seconds 3
    if (Is-Alive $FRONTEND_PID_FILE) {
        Log-Info "Frontend 启动成功 (PID=$($proc.Id))"
    } else {
        Log-Error "Frontend 启动失败，查看日志: $FRONTEND_LOG"
    }
}

function Frontend-Stop {
    if (Test-Path $FRONTEND_PID_FILE) {
        $pid = Get-Content $FRONTEND_PID_FILE -ErrorAction SilentlyContinue
        if ($pid -and (Get-Process -Id $pid -ErrorAction SilentlyContinue)) {
            Log-Info "停止 Frontend (PID=$pid)..."
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1
        }
        Remove-Item $FRONTEND_PID_FILE -Force -ErrorAction SilentlyContinue
    }
    Kill-Port $FRONTEND_PORT "Frontend" | Out-Null
    Log-Info "Frontend 已停止"
}

function Frontend-Status {
    $pid = Find-PidOnPort $FRONTEND_PORT
    if ($pid) {
        Write-Host "Frontend  " -NoNewline
        Write-Host "● 运行中" -ForegroundColor Green -NoNewline
        Write-Host "  端口=$FRONTEND_PORT  PID=$pid"
    } else {
        Write-Host "Frontend  " -NoNewline
        Write-Host "○ 未运行" -ForegroundColor Red
    }
}

# ── All ───────────────────────────────────────────────
function All-Start   { Backend-Start;  Frontend-Start }
function All-Stop    { Frontend-Stop;  Backend-Stop }
function All-Status  { Backend-Status; Frontend-Status }

# ── 入口 ──────────────────────────────────────────────
if (-not $Action) {
    Write-Host "用法: .\manju.ps1 {start|stop|restart|status} [backend|frontend|all]"
    Write-Host ""
    Write-Host "服务:"
    Write-Host "  backend   FastAPI :$BACKEND_PORT"
    Write-Host "  frontend  Next.js :$FRONTEND_PORT"
    Write-Host "  all       全部服务 (默认)"
    exit 1
}

switch ($Action) {
    "start" {
        switch ($Target) {
            "backend"  { Backend-Start }
            "frontend" { Frontend-Start }
            "all"      { All-Start }
        }
    }
    "stop" {
        switch ($Target) {
            "backend"  { Backend-Stop }
            "frontend" { Frontend-Stop }
            "all"      { All-Stop }
        }
    }
    "restart" {
        switch ($Target) {
            "backend"  { Backend-Stop;  Start-Sleep 1; Backend-Start }
            "frontend" { Frontend-Stop; Start-Sleep 1; Frontend-Start }
            "all"      { All-Stop;      Start-Sleep 1; All-Start }
        }
    }
    "status" {
        switch ($Target) {
            "backend"  { Backend-Status }
            "frontend" { Frontend-Status }
            "all"      { All-Status }
        }
    }
}
