"""Manju Production OS — FastAPI 入口"""

import logging
import logging.config
import sys
import asyncio

from config import settings as _log_settings

_LOG_LEVEL = getattr(_log_settings, "LOG_LEVEL", "INFO").upper()
_LOG_FORMAT = getattr(_log_settings, "LOG_FORMAT", "json").lower()
_IS_DEBUG = getattr(_log_settings, "DEBUG", False)

if _IS_DEBUG or _LOG_FORMAT == "text":
    # Human-readable text format (DEBUG mode or explicit text)
    logging.basicConfig(
        level=_LOG_LEVEL,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        stream=sys.stdout,
    )
else:
    # Structured JSON format for production
    from pythonjsonlogger import jsonlogger

    _json_handler = logging.StreamHandler(sys.stdout)
    _json_formatter = jsonlogger.JsonFormatter(
        "%(asctime)s %(levelname)s %(name)s %(message)s",
        rename_fields={"asctime": "timestamp", "levelname": "level", "name": "logger"},
    )
    _json_handler.setFormatter(_json_formatter)

    logging.basicConfig(level=_LOG_LEVEL, handlers=[_json_handler], force=True)
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Set

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings, validate_config
from database.connection import Base, async_engine
from middleware.auth import AuthMiddleware
from middleware.rate_limit import limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from services.broadcast import broadcast
from config import settings as _settings
from routers import (
    projects_router,
    apikeys_router,
    episodes_router,
    scenes_router,
    qa_router,
    assets_router,
    publish_router,
    analytics_router,
    knowledge_router,
    jobs_router,
    workspace_router,
    workspaces_router,
    system_router,
    files_router,
    story_bibles_router,
    characters_router,
    locations_router,
    script_parse_router,
    props_router,
    prompt_templates_router,
    stills_router,
    complexity_router,
    timeline_router,
    costs_router,
    status_router,
    auth_router,
)

# ── WebSocket 连接池 ──
_active_websockets: Set[WebSocket] = set()

logger = logging.getLogger("manju")


async def _broadcast_progress(event: dict):
    """广播进度事件到所有 WebSocket 连接"""
    if not _active_websockets:
        return

    # 构造广播消息
    message = {
        "type": "progress",
        **event,
    }

    # 并发发送给所有连接
    tasks = []
    for ws in list(_active_websockets):  # 使用 list 副本避免迭代时修改
        try:
            tasks.append(ws.send_json(message))
        except Exception as e:
            logger.warning("WebSocket failed to prepare send: %s", e)

    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)


def register_progress_callback(callback: callable):
    """注册进度广播回调（供 orchestrator 使用）"""
    # 注意：这里需要调用 orchestrator 的注册函数
    from services.pipeline.orchestrator import register_progress_callback as register_orchestrator_callback
    register_orchestrator_callback(callback)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """启动时建表，关闭时清理"""
    # 注册 progress callback
    register_progress_callback(_broadcast_progress)

    # 建表（可通过 DB_AUTO_CREATE=false 禁止）
    if settings.DB_AUTO_CREATE:
        async with async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    # 初始管理员策略
    admin_email = settings.MANJU_ADMIN_EMAIL
    admin_password = settings.MANJU_ADMIN_PASSWORD
    if admin_email and admin_password:
        from sqlalchemy import select, func
        from database.connection import async_session_factory
        from database.models import User
        from services.auth import hash_password

        async with async_session_factory() as session:
            count = await session.execute(select(func.count()).select_from(User))
            if count.scalar() == 0:
                admin = User(
                    email=admin_email,
                    password_hash=hash_password(admin_password),
                    display_name="Admin",
                    role="admin",
                )
                session.add(admin)
                await session.commit()
                logger.info("Initial admin user created: %s", admin_email)
    else:
        logger.warning(
            "MANJU_ADMIN_EMAIL / MANJU_ADMIN_PASSWORD not set. "
            "Create admin via POST /api/auth/register"
        )

    yield
    await async_engine.dispose()


app = FastAPI(
    title="Manju Production OS",
    description="AI 漫剧工业化生产操作系统 — ArcLine",
    version="0.2.0",
    lifespan=lifespan,
    redirect_slashes=False,
)

# Security config validation (before middleware/routers)
validate_config()

# CORS
_cors_origins = settings.CORS_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors_origins],
    allow_credentials=_cors_origins != ["*"],
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Audit logging (before auth so we log all write attempts)
from middleware.audit_log import AuditLogMiddleware
app.add_middleware(AuditLogMiddleware)

# Auth middleware (before routers so it runs first)
app.add_middleware(AuthMiddleware)

# 注册路由
app.include_router(projects_router)
app.include_router(apikeys_router)
app.include_router(episodes_router)
app.include_router(scenes_router)
app.include_router(qa_router)
app.include_router(assets_router)
app.include_router(publish_router)
app.include_router(analytics_router)
app.include_router(knowledge_router)
app.include_router(jobs_router)
app.include_router(workspace_router)
app.include_router(workspaces_router)
app.include_router(system_router)
app.include_router(files_router)
app.include_router(story_bibles_router)
app.include_router(characters_router)
app.include_router(locations_router)
app.include_router(script_parse_router)
app.include_router(props_router)
app.include_router(prompt_templates_router)
app.include_router(stills_router)
app.include_router(complexity_router)
app.include_router(timeline_router)
app.include_router(costs_router)
app.include_router(status_router)
app.include_router(auth_router)


# ── 全局异常处理器 ──
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url)
    return JSONResponse(
        status_code=500,
        content={"code": "INTERNAL_ERROR", "message": "服务器内部错误", "details": {}},
    )


# WebSocket 升级版本
@app.websocket("/ws/{channel}")
async def ws_channel(ws: WebSocket, channel: str):
    """频道级 WebSocket 广播（多标签同步）"""
    import os
    env = os.getenv("ENVIRONMENT", "development").lower()
    if env not in ("development", "debug"):
        await ws.close(code=1008, reason="WebSocket not available in production")
        return
    accepted = await broadcast.connect(channel, ws)
    if not accepted:
        await ws.close(code=1013, reason=f"Maximum WebSocket connections reached ({_settings.MAX_WS_CONNECTIONS})")
        return
    try:
        while True:
            data = await ws.receive_text()
            # 客户端消息暂不处理，广播由服务端触发
    except Exception:
        pass
    finally:
        broadcast.disconnect(channel, ws)


@app.websocket("/ws/live")
async def websocket_live(websocket: WebSocket):
    """实时进度推送（支持作业进度广播）"""
    import os
    env = os.getenv("ENVIRONMENT", "development").lower()
    if env not in ("development", "debug"):
        await websocket.close(code=1008, reason="WebSocket not available in production")
        return

    # 连接数限制检查
    if len(_active_websockets) >= _settings.MAX_WS_CONNECTIONS:
        await websocket.close(code=1013, reason=f"Maximum WebSocket connections reached ({_settings.MAX_WS_CONNECTIONS})")
        return

    await websocket.accept()

    # 加入连接池
    _active_websockets.add(websocket)
    logger.debug("WebSocket client connected. Total: %d", len(_active_websockets))

    try:
        # 发送欢迎消息
        await websocket.send_json({
            "type": "connected",
            "message": "WebSocket connected successfully",
            "timestamp": asyncio.get_event_loop().time(),
        })

        # 保持连接，接收 ping
        while True:
            data = await websocket.receive_text()

            # 处理 ping（简单回显 pong）
            if data.strip().lower() in ("ping", "ping()"):
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": asyncio.get_event_loop().time(),
                })
            else:
                # 其他消息也回显（便于调试）
                await websocket.send_json({
                    "type": "echo",
                    "message": data,
                })

    except WebSocketDisconnect:
        logger.debug("WebSocket client disconnected gracefully")
    except Exception as e:
        logger.warning("WebSocket error: %s", e)
    finally:
        # 从连接池移除
        _active_websockets.discard(websocket)
        logger.debug("WebSocket client removed. Total: %d", len(_active_websockets))


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": "0.2.0"}


@app.post("/api/seed")
async def seed_demo_data():
    """生成 mock 演示数据（仅开发环境用）"""
    import os
    env = os.getenv("ENVIRONMENT", "development").lower()
    if env not in ("development", "debug"):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Seed endpoint is only available in development mode")
    import uuid
    from database.connection import async_session_factory
    from database.models import Project, Episode, Scene

    pid = uuid.uuid4().hex
    eid = uuid.uuid4().hex

    async with async_session_factory() as session:
        project = Project(
            id=pid,
            name="复仇之花 — Demo 项目",
            genre="Revenge",
            market="US",
            platform="tiktok",
            tier="SSS",
            status="DRAFT",
            description="Demo project for development testing",
        )
        session.add(project)

        episode = Episode(
            id=eid,
            project_id=pid,
            episode_no=1,
            title="第一章：复仇的开始",
            outline="女主发现丈夫背叛，开始策划复仇",
            status="DRAFT",
        )
        session.add(episode)

        for i in range(3):
            scene = Scene(
                id=uuid.uuid4().hex,
                episode_id=eid,
                scene_no=i+1,
                title=f"场景 {i+1}",
                status="DRAFT",
            )
            session.add(scene)

        await session.commit()

    return {
        "message": "Demo data seeded",
        "project_id": pid,
        "episode_id": eid,
    }


@app.post("/api/seed-multitenancy")
async def seed_multitenancy():
    """
    创建多租户测试账号（仅开发环境）：
      superadmin@manju.ai / SuperAdmin123!  → role=superadmin
      manager001@manju.ai / Manager123!     → role=manager, Workspace "测试空间"
      manager002@manju.ai / Manager123!     → role=manager, Workspace "测试空间2"
      employer001@manju.ai / Emp123!        → role=employer, 权限仅 ["/workspace/story"]
    幂等：已存在则跳过。
    """
    import os
    env = os.getenv("ENVIRONMENT", "development").lower()
    if env not in ("development", "debug"):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Only available in development mode")

    import uuid
    from sqlalchemy import select
    from database.connection import async_session_factory
    from database.models import User, Workspace, WorkspaceMember
    from services.auth import hash_password

    results: dict = {}

    async with async_session_factory() as session:

        async def get_or_create_user(email: str, password: str, display: str, role: str) -> User:
            row = await session.execute(select(User).where(User.email == email))
            u = row.scalar_one_or_none()
            if u is None:
                u = User(
                    id=uuid.uuid4().hex,
                    email=email,
                    password_hash=hash_password(password),
                    display_name=display,
                    role=role,
                    is_active=True,
                )
                session.add(u)
                await session.flush()
                results[email] = "created"
            else:
                results[email] = "already_exists"
            return u

        async def get_or_create_workspace(name: str, owner: User) -> Workspace:
            row = await session.execute(select(Workspace).where(Workspace.owner_id == owner.id))
            ws = row.scalar_one_or_none()
            if ws is None:
                ws = Workspace(
                    id=uuid.uuid4().hex,
                    name=name,
                    owner_id=owner.id,
                    max_employers=5,
                    is_active=True,
                )
                session.add(ws)
                await session.flush()
            return ws

        async def get_or_create_member(ws: Workspace, user: User, inviter: User, perms: list) -> None:
            row = await session.execute(
                select(WorkspaceMember).where(
                    WorkspaceMember.workspace_id == ws.id,
                    WorkspaceMember.user_id == user.id,
                )
            )
            if row.scalar_one_or_none() is None:
                m = WorkspaceMember(
                    id=uuid.uuid4().hex,
                    workspace_id=ws.id,
                    user_id=user.id,
                    role="employer",
                    page_permissions=perms,
                    invited_by=inviter.id,
                )
                session.add(m)
                await session.flush()

        # 1. superadmin
        await get_or_create_user("superadmin@manju.ai", "SuperAdmin123!", "超级管理员", "superadmin")

        # 2. manager001 + 工作区"测试空间"
        mgr1 = await get_or_create_user("manager001@manju.ai", "Manager123!", "Manager 001", "manager")
        ws1 = await get_or_create_workspace("测试空间", mgr1)
        # manager self-membership
        row = await session.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == ws1.id,
                WorkspaceMember.user_id == mgr1.id,
            )
        )
        if row.scalar_one_or_none() is None:
            session.add(WorkspaceMember(
                id=uuid.uuid4().hex,
                workspace_id=ws1.id,
                user_id=mgr1.id,
                role="manager",
                page_permissions=[],
                invited_by=None,
            ))
            await session.flush()

        # 3. manager002 + 工作区"测试空间2"
        mgr2 = await get_or_create_user("manager002@manju.ai", "Manager123!", "Manager 002", "manager")
        ws2 = await get_or_create_workspace("测试空间2", mgr2)
        row = await session.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == ws2.id,
                WorkspaceMember.user_id == mgr2.id,
            )
        )
        if row.scalar_one_or_none() is None:
            session.add(WorkspaceMember(
                id=uuid.uuid4().hex,
                workspace_id=ws2.id,
                user_id=mgr2.id,
                role="manager",
                page_permissions=[],
                invited_by=None,
            ))
            await session.flush()

        # 4. employer001 → ws1, 权限仅 /workspace/story
        emp1 = await get_or_create_user("employer001@manju.ai", "Emp123!", "Employer 001", "employer")
        await get_or_create_member(ws1, emp1, mgr1, ["/workspace/story"])

        await session.commit()

    return {"message": "Multitenancy seed complete", "results": results}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
