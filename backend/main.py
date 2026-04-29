"""Manju Production OS — FastAPI 入口"""

import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from database.connection import Base, async_engine
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
    files_router,
    story_bibles_router,
    characters_router,
)

# ── WebSocket 连接池 ──
_active_websockets: Set[WebSocket] = set()


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
            print(f"[WebSocket] Failed to prepare send: {e}")

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

    # 建表
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await async_engine.dispose()


app = FastAPI(
    title="Manju Production OS",
    description="AI 漫剧工业化生产操作系统 — ArcLine",
    version="0.2.0",
    lifespan=lifespan,
    redirect_slashes=False,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
app.include_router(files_router)
app.include_router(story_bibles_router)
app.include_router(characters_router)


# WebSocket 升级版本
@app.websocket("/ws/live")
async def websocket_live(websocket: WebSocket):
    """实时进度推送（支持作业进度广播）"""
    await websocket.accept()

    # 加入连接池
    _active_websockets.add(websocket)
    print(f"[WebSocket] Client connected. Total connections: {len(_active_websockets)}")

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
        print(f"[WebSocket] Client disconnected gracefully")
    except Exception as e:
        print(f"[WebSocket] Error: {e}")
    finally:
        # 从连接池移除
        _active_websockets.discard(websocket)
        print(f"[WebSocket] Client removed. Total connections: {len(_active_websockets)}")


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": "0.2.0"}


@app.post("/api/seed")
async def seed_demo_data():
    """生成 mock 演示数据（仅开发环境用）"""
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
            synopsis="女主发现丈夫背叛，开始策划复仇",
            status="DRAFT",
        )
        session.add(episode)

        for i in range(3):
            scene = Scene(
                id=uuid.uuid4().hex,
                project_id=pid,
                episode_id=eid,
                scene_no=f"S{i+1:03d}",
                title=f"场景 {i+1}",
                status="DRAFT",
                beat_sheet={"beat": f"beat_{i+1}"},
            )
            session.add(scene)

        await session.commit()

    return {
        "message": "Demo data seeded",
        "project_id": pid,
        "episode_id": eid,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
