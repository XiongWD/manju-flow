#!/usr/bin/env python3
"""
Manju Production OS — 连通性测试脚本

验证所有服务和工具的安装与连通状态。
绿色 = 通过，黄色 = 警告（非阻塞），红色 = 失败。

用法:
    python3 scripts/test_connectivity.py
    python3 scripts/test_connectivity.py --verbose
"""

import json
import os
import sqlite3
import subprocess
import sys
import urllib.request
import urllib.error
from pathlib import Path

# ── 配置 ──────────────────────────────────────────────────────────────────────

PROJECT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = PROJECT_DIR / "backend"
ENV_FILE = BACKEND_DIR / ".env"
DB_FILE = BACKEND_DIR / "manju.db"

RED = "\033[0;31m"
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
BOLD = "\033[1m"
NC = "\033[0m"


def load_env() -> dict[str, str]:
    """加载 .env 文件（简易实现，不依赖 python-dotenv）。"""
    env = {}
    if not ENV_FILE.exists():
        return env
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, _, value = line.partition("=")
            env[key.strip()] = value.strip()
    return env


class Result:
    def __init__(self, name: str, passed: bool, msg: str, blocking: bool = True):
        self.name = name
        self.passed = passed
        self.msg = msg
        self.blocking = blocking

    def icon(self):
        if self.passed:
            return f"{GREEN}✓ PASS{NC}"
        elif not self.blocking:
            return f"{YELLOW}⚠ WARN{NC}"
        else:
            return f"{RED}✗ FAIL{NC}"

    def __str__(self):
        return f"  {self.icon()}  {self.name}: {self.msg}"


def check_command(name: str, cmd: str, min_version: str | None = None) -> Result:
    """检查 CLI 工具是否可用。"""
    try:
        proc = subprocess.run(
            cmd.split(), capture_output=True, text=True, timeout=10
        )
        if proc.returncode != 0:
            return Result(name, False, f"命令执行失败: {proc.stderr[:100]}", blocking=True)

        if min_version:
            stdout = proc.stdout + proc.stderr
            # 提取版本号
            import re
            match = re.search(r"(\d+)\.(\d+)", stdout)
            if match:
                major, minor = int(match.group(1)), int(match.group(2))
                req_major, req_minor = (int(x) for x in min_version.split("."))
                if (major, minor) < (req_major, req_minor):
                    return Result(
                        name, False,
                        f"版本 {major}.{minor} < {min_version}",
                        blocking=True,
                    )
                return Result(name, True, f"版本 {major}.{minor}.{match.group(0).split('.')[2] if len(match.group(0).split('.')) > 2 else 'x'}")
            return Result(name, True, "已安装（版本解析失败）")

        return Result(name, True, "已安装")
    except FileNotFoundError:
        return Result(name, False, "未安装", blocking=True)
    except subprocess.TimeoutExpired:
        return Result(name, False, "执行超时", blocking=True)


def check_python() -> Result:
    try:
        proc = subprocess.run(
            [sys.executable, "-c", "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')"],
            capture_output=True, text=True, timeout=5,
        )
        ver = proc.stdout.strip()
        major, minor = int(ver.split(".")[0]), int(ver.split(".")[1])
        if (major, minor) >= (3, 11):
            return Result("Python", True, f"Python {ver}")
        return Result("Python", False, f"Python {ver} < 3.11", blocking=True)
    except Exception as e:
        return Result("Python", False, str(e))


def check_node() -> Result:
    try:
        proc = subprocess.run(
            ["node", "-v"], capture_output=True, text=True, timeout=5,
        )
        ver = proc.stdout.strip().lstrip("v")
        major = int(ver.split(".")[0])
        if major >= 18:
            return Result("Node.js", True, f"v{ver}")
        return Result("Node.js", False, f"v{ver} < 18", blocking=True)
    except FileNotFoundError:
        return Result("Node.js", False, "未安装", blocking=True)


def check_ffmpeg() -> Result:
    try:
        proc = subprocess.run(
            ["ffmpeg", "-version"], capture_output=True, text=True, timeout=5,
        )
        first_line = proc.stdout.split("\n")[0]
        import re
        match = re.search(r"ffmpeg version (\d+)\.(\d+)", first_line)
        if match:
            major, minor = int(match.group(1)), int(match.group(2))
            if (major, minor) >= (6, 0):
                return Result("FFmpeg", True, f"版本 {major}.{minor}")
            return Result("FFmpeg", False, f"版本 {major}.{minor} < 6.0", blocking=True)
        # Nightly builds: "ffmpeg version N-XXXXXX-gHASH Copyright ..."
        if "N-" in first_line:
            return Result("FFmpeg", True, "nightly build (最新版, ≥ 6.0)")
        return Result("FFmpeg", False, f"无法解析版本: {first_line[:60]}", blocking=True)
    except FileNotFoundError:
        return Result("FFmpeg", False, "未安装", blocking=True)


def check_sqlite() -> Result:
    try:
        conn = sqlite3.connect(str(DB_FILE))
        cursor = conn.cursor()
        cursor.execute("SELECT sqlite_version()")
        ver = cursor.fetchone()[0]
        # 测试读写
        cursor.execute(
            "INSERT OR REPLACE INTO _manju_meta (key, value) VALUES ('connectivity_test', datetime('now'))"
        )
        conn.commit()
        cursor.execute("SELECT value FROM _manju_meta WHERE key = 'connectivity_test'")
        val = cursor.fetchone()[0]
        conn.close()
        return Result("SQLite", True, f"SQLite {ver}, 读写正常, DB: {DB_FILE}")
    except sqlite3.Error as e:
        return Result("SQLite", False, str(e))
    except Exception as e:
        return Result("SQLite", False, f"数据库文件不存在或无法访问: {e}")


def check_c2patool() -> Result:
    # 优先检查 c2patool CLI（Rust 版本）
    try:
        proc = subprocess.run(
            ["c2patool", "--version"], capture_output=True, text=True, timeout=10,
        )
        if proc.returncode == 0:
            return Result("c2patool", True, f"CLI {proc.stdout.strip() or '已安装'}")
    except FileNotFoundError:
        pass
    # 回退：检查 c2pa Python 库（系统 Python 和 venv Python）
    pythons_to_try = [sys.executable]
    venv_python = BACKEND_DIR / ".venv" / "bin" / "python3"
    if venv_python.exists() and str(venv_python) != sys.executable:
        pythons_to_try.append(str(venv_python))
    for py in pythons_to_try:
        try:
            proc = subprocess.run(
                [py, "-c", "import c2pa; print(c2pa.__version__)"],
                capture_output=True, text=True, timeout=10,
            )
            if proc.returncode == 0:
                return Result("c2patool", True, f"Python c2pa v{proc.stdout.strip()}")
        except Exception:
            pass
    return Result("c2patool", False, "未安装（需要 Rust c2patool 或 pip install c2pa-python）", blocking=True)


def check_comfyui(env: dict) -> Result:
    """检查 ComfyUI API 可达性。"""
    url = env.get("COMFYUI_API_URL")
    if not url:
        host = env.get("COMFYUI_HOST", "")
        port = env.get("COMFYUI_PORT", "8188")
        if host:
            url = f"http://{host}:{port}"
        else:
            return Result("ComfyUI", False, "未配置 COMFYUI_API_URL / COMFYUI_HOST", blocking=True)

    # 去掉尾部斜杠
    url = url.rstrip("/")
    try:
        req = urllib.request.Request(
            f"{url}/system_stats",
            headers={"Accept": "application/json"},
            method="GET",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            return Result("ComfyUI", True, f"API 可达, URL: {url}")
    except urllib.error.URLError as e:
        return Result("ComfyUI", False, f"连接失败: {e.reason}", blocking=True)
    except Exception as e:
        return Result("ComfyUI", False, str(e))


def check_api_key(name: str, key: str, base_url: str | None = None) -> Result:
    """检查 API Key 是否已配置（可选，不阻塞）。"""
    if not key:
        return Result(f"API Key: {name}", False, "未配置", blocking=False)
    return Result(f"API Key: {name}", True, f"已配置 (长度={len(key)})")


def main():
    env = load_env()
    verbose = "--verbose" in sys.argv

    results: list[Result] = []

    print(f"\n{BOLD}{'═' * 60}{NC}")
    print(f"{BOLD}  Manju Production OS — 连通性测试{NC}")
    print(f"{BOLD}{'═' * 60}{NC}\n")

    # ── 核心工具（阻塞） ──
    print(f"{BOLD}── 核心工具 ──{NC}")
    results.append(check_python())
    results.append(check_node())
    results.append(check_ffmpeg())
    results.append(check_sqlite())
    results.append(check_c2patool())

    # ── 远程服务（阻塞） ──
    print(f"\n{BOLD}── 远程服务 ──{NC}")
    results.append(check_comfyui(env))

    # ── API Keys（非阻塞） ──
    print(f"\n{BOLD}── API Keys（可选） ──{NC}")
    results.append(check_api_key("Kling 3.0", env.get("KLING_API_KEY", "")))
    results.append(check_api_key("Seedance 2.0", env.get("SEEDANCE_API_KEY", "")))
    results.append(check_api_key("ElevenLabs", env.get("ELEVENLABS_API_KEY", "")))
    results.append(check_api_key("Fish Audio", env.get("FISH_AUDIO_API_KEY", "")))
    results.append(check_api_key("Vast.ai", env.get("VAST_API_KEY", "")))

    # ── 输出结果 ──
    print(f"\n{BOLD}{'═' * 60}{NC}")
    for r in results:
        print(r)

    # ── 汇总 ──
    blocking_fails = [r for r in results if not r.passed and r.blocking]
    optional_fails = [r for r in results if not r.passed and not r.blocking]
    all_passed = len(blocking_fails) == 0

    print(f"\n{BOLD}{'═' * 60}{NC}")
    if all_passed:
        print(f"  {GREEN}{'★ 全部通过 ★':^50}{NC}")
    else:
        print(f"  {RED}{'✗ 存在失败项':^50}{NC}")
        print(f"\n  {RED}阻塞项（必须修复）:{NC}")
        for r in blocking_fails:
            print(f"    {RED}✗{NC} {r.name}: {r.msg}")

    if optional_fails:
        print(f"\n  {YELLOW}可选项（非阻塞）:{NC}")
        for r in optional_fails:
            print(f"    {YELLOW}⚠{NC} {r.name}: {r.msg}")

    print(f"\n{BOLD}{'═' * 60}{NC}\n")

    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
