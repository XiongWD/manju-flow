# manju.ps1 - Manju service manager (Windows PowerShell 5.1+)
# Usage: .\manju.ps1 {start|stop|restart|status} [backend|frontend|all]

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

# -- Config --
$MANJU_ROOT    = (Resolve-Path "$PSScriptRoot\..").Path
$BACKEND_DIR   = "$MANJU_ROOT\backend"
$FRONTEND_DIR  = "$MANJU_ROOT\frontend-next"

$BACKEND_PORT  = 8000
$FRONTEND_PORT = 3000

$BACKEND_PID_FILE  = "$MANJU_ROOT\.manju-backend.pid"
$FRONTEND_PID_FILE = "$MANJU_ROOT\.manju-frontend.pid"

$LOG_DIR      = "$MANJU_ROOT\logs"
$BACKEND_LOG  = "$LOG_DIR\backend.log"
$FRONTEND_LOG = "$LOG_DIR\frontend.log"

# -- Logging --
function Log-Info  { param($msg) Write-Host "[INFO]  $msg" -ForegroundColor Green }
function Log-Warn  { param($msg) Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function Log-Error { param($msg) Write-Host "[ERROR] $msg" -ForegroundColor Red }

# -- Helpers --
if (-not (Test-Path $LOG_DIR)) { New-Item -ItemType Directory -Path $LOG_DIR | Out-Null }

function Find-PidOnPort {
    param([int]$Port)
    $conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
            Where-Object { $_.State -eq "Listen" } |
            Select-Object -First 1
    if ($conn) { return $conn.OwningProcess }
    return $null
}

function Kill-Port {
    param([int]$Port, [string]$Name)
    $p = Find-PidOnPort $Port
    if ($p) {
        Log-Warn "$Name port $Port occupied by PID=$p, cleaning up..."
        try { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue } catch {}
        Start-Sleep -Milliseconds 800
        if (Get-Process -Id $p -ErrorAction SilentlyContinue) {
            Log-Error "Cannot free port $Port (PID=$p), please handle manually"
            return $false
        }
        Log-Info "Port $Port released"
    }
    return $true
}
function Is-Alive {
    param([string]$PidFile)
    if (-not (Test-Path $PidFile)) { return $false }
    $p = Get-Content $PidFile -ErrorAction SilentlyContinue
    if (-not $p) { return $false }
    return [bool](Get-Process -Id $p -ErrorAction SilentlyContinue)
}

# -- Backend (FastAPI :8000) --
function Backend-Start {
    if (Is-Alive $BACKEND_PID_FILE) {
        $p = Get-Content $BACKEND_PID_FILE
        Log-Info "Backend already running (PID=$p)"
        return
    }
    Kill-Port $BACKEND_PORT "Backend" | Out-Null

    Log-Info "Starting Backend (port $BACKEND_PORT)..."

    # Resolve python: prefer venv, fallback to system python
    $python = (Get-Command python -ErrorAction SilentlyContinue).Source
    if (-not $python) { $python = "python" }
    if (Test-Path "$BACKEND_DIR\.venv\Scripts\python.exe") {
        $python = "$BACKEND_DIR\.venv\Scripts\python.exe"
    } elseif (Test-Path "$BACKEND_DIR\venv\Scripts\python.exe") {
        $python = "$BACKEND_DIR\venv\Scripts\python.exe"
    }

    # Install dependencies if requirements.txt exists
    if (Test-Path "$BACKEND_DIR\requirements.txt") {
        Log-Info "Installing backend dependencies..."
        & $python -m pip install -r "$BACKEND_DIR\requirements.txt" -q
    }

    $proc = Start-Process -FilePath $python `
        -ArgumentList "-m","uvicorn","main:app","--host","0.0.0.0","--port","$BACKEND_PORT" `
        -WorkingDirectory $BACKEND_DIR `
        -RedirectStandardOutput $BACKEND_LOG `
        -RedirectStandardError "$BACKEND_LOG.err" `
        -WindowStyle Hidden `
        -PassThru

    $proc.Id | Set-Content $BACKEND_PID_FILE
    Start-Sleep -Seconds 5

    if (Find-PidOnPort $BACKEND_PORT) {
        Log-Info "Backend started (PID=$($proc.Id))"
    } else {
        Log-Error "Backend failed to start, check log: $BACKEND_LOG"
    }
}

function Backend-Stop {
    if (Test-Path $BACKEND_PID_FILE) {
        $p = Get-Content $BACKEND_PID_FILE -ErrorAction SilentlyContinue
        if ($p -and (Get-Process -Id $p -ErrorAction SilentlyContinue)) {
            Log-Info "Stopping Backend (PID=$p)..."
            Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1
        }
        Remove-Item $BACKEND_PID_FILE -Force -ErrorAction SilentlyContinue
    }
    Kill-Port $BACKEND_PORT "Backend" | Out-Null
    Log-Info "Backend stopped"
}

function Backend-Status {
    $p = Find-PidOnPort $BACKEND_PORT
    if ($p) {
        Write-Host "Backend   " -NoNewline
        Write-Host "[RUNNING]" -ForegroundColor Green -NoNewline
        Write-Host "  port=$BACKEND_PORT  PID=$p"
    } else {
        Write-Host "Backend   " -NoNewline
        Write-Host "[STOPPED]" -ForegroundColor Red
    }
}

# -- Frontend (Next.js :3000) --
function Frontend-Start {
    if (Is-Alive $FRONTEND_PID_FILE) {
        $p = Get-Content $FRONTEND_PID_FILE
        Log-Info "Frontend already running (PID=$p)"
        return
    }
    Kill-Port $FRONTEND_PORT "Frontend" | Out-Null

    Log-Info "Starting Frontend (port $FRONTEND_PORT)..."

    # On Windows, npx is a .cmd file; must invoke via cmd.exe
    $proc = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c","npx.cmd","next","dev","-H","0.0.0.0","-p","$FRONTEND_PORT" `
        -WorkingDirectory $FRONTEND_DIR `
        -RedirectStandardOutput $FRONTEND_LOG `
        -RedirectStandardError "$FRONTEND_LOG.err" `
        -WindowStyle Hidden `
        -PassThru

    $proc.Id | Set-Content $FRONTEND_PID_FILE
    Start-Sleep -Seconds 5

    if (Find-PidOnPort $FRONTEND_PORT) {
        Log-Info "Frontend started (PID=$($proc.Id))"
    } else {
        Log-Error "Frontend failed to start, check log: $FRONTEND_LOG"
    }
}

function Frontend-Stop {
    if (Test-Path $FRONTEND_PID_FILE) {
        $p = Get-Content $FRONTEND_PID_FILE -ErrorAction SilentlyContinue
        if ($p -and (Get-Process -Id $p -ErrorAction SilentlyContinue)) {
            Log-Info "Stopping Frontend (PID=$p)..."
            Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1
        }
        Remove-Item $FRONTEND_PID_FILE -Force -ErrorAction SilentlyContinue
    }
    Kill-Port $FRONTEND_PORT "Frontend" | Out-Null
    Log-Info "Frontend stopped"
}

function Frontend-Status {
    $p = Find-PidOnPort $FRONTEND_PORT
    if ($p) {
        Write-Host "Frontend  " -NoNewline
        Write-Host "[RUNNING]" -ForegroundColor Green -NoNewline
        Write-Host "  port=$FRONTEND_PORT  PID=$p"
    } else {
        Write-Host "Frontend  " -NoNewline
        Write-Host "[STOPPED]" -ForegroundColor Red
    }
}

# -- All --
function All-Start  { Backend-Start;  Frontend-Start }
function All-Stop   { Frontend-Stop;  Backend-Stop }
function All-Status { Backend-Status; Frontend-Status }

# -- Entry --
if (-not $Action) {
    Write-Host "Usage: .\manju.ps1 {start|stop|restart|status} [backend|frontend|all]"
    Write-Host ""
    Write-Host "Services:"
    Write-Host "  backend   FastAPI  :$BACKEND_PORT"
    Write-Host "  frontend  Next.js  :$FRONTEND_PORT"
    Write-Host "  all       Both services (default)"
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