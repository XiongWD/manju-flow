"""Manju Production OS — FastAPI 入口"""

import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator

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
)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """启动时建表，关闭时清理"""
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


# WebSocket stub
@app.websocket("/ws/live")
async def websocket_live(websocket: WebSocket):
    """实时事件推送（stub）"""
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_json({"type": "pong", "echo": data})
    except WebSocketDisconnect:
        pass


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
            tier="A",
            budget_limit=50.0,
            status="in_production",
            description="Mock demo: 复仇题材 A 级短剧",
        )
        session.add(project)

        episode = Episode(
            id=eid,
            project_id=pid,
            episode_no=1,
            title="第 1 集：重逢",
            outline="女主在咖啡馆偶遇前男友和闺蜜",
            status="IN_PRODUCTION",
        )
        session.add(episode)

        scene_titles = [
            "咖啡馆门口",
            "店内偶遇",
            "闺蜜出场",
            "对峙",
            "回忆闪回",
        ]
        for i, title in enumerate(scene_titles):
            scene = Scene(
                id=uuid.uuid4().hex,
                episode_id=eid,
                scene_no=i + 1,
                title=title,
                duration=8.0 + i * 2,
                status="DRAFT",
            )
            session.add(scene)

        await session.commit()

    return {"data": {"project_id": pid, "episode_id": eid, "message": "Demo 数据已生成"}}
