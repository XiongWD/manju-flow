"""剧集路由 — 完整 CRUD 实现"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_db
from database.models import Episode, Scene, SceneVersion
from schemas.episode import EpisodeCreate, EpisodeUpdate, EpisodeRead, EpisodeWithScenesRead
from schemas.scene import SceneWithVersionSummary, SceneVersionSummary
from services.pipeline.orchestrator import start_mock_scene_job

router = APIRouter(prefix="/api/episodes", tags=["episodes"])


@router.get("/", response_model=list[EpisodeRead])
async def list_episodes(
    project_id: str = Query(None, description="项目 ID"),
    db: AsyncSession = Depends(get_db),
):
    """获取剧集列表"""
    q = select(Episode)
    if project_id:
        q = q.where(Episode.project_id == project_id)
    q = q.order_by(Episode.episode_no)
    result = await db.execute(q)
    episodes = result.scalars().all()
    return episodes


@router.post("/", response_model=EpisodeRead, status_code=status.HTTP_201_CREATED)
async def create_episode(body: EpisodeCreate, db: AsyncSession = Depends(get_db)):
    """创建剧集"""
    episode = Episode(**body.model_dump())
    db.add(episode)
    await db.flush()
    await db.refresh(episode)
    return episode


@router.get("/{episode_id}", response_model=EpisodeWithScenesRead)
async def get_episode(episode_id: str, db: AsyncSession = Depends(get_db)):
    """获取单个剧集详情，含场景列表"""
    ep = await db.get(Episode, episode_id)
    if not ep:
        raise HTTPException(status_code=404, detail="Episode not found")

    # 获取场景列表
    scenes_q = select(Scene).where(Scene.episode_id == episode_id).order_by(Scene.scene_no)
    scenes_result = await db.execute(scenes_q)
    scenes = scenes_result.scalars().all()

    scene_list = []
    for s in scenes:
        # 获取最新版本
        sv_q = (
            select(SceneVersion)
            .where(SceneVersion.scene_id == s.id)
            .order_by(SceneVersion.version_no.desc())
            .limit(1)
        )
        sv_result = await db.execute(sv_q)
        latest_sv = sv_result.scalar_one_or_none()

        scene_list.append(SceneWithVersionSummary(
            id=s.id,
            episode_id=s.episode_id,
            scene_no=s.scene_no,
            title=s.title,
            duration=s.duration,
            status=s.status,
            locked_version_id=s.locked_version_id,
            created_at=s.created_at,
            updated_at=s.updated_at,
            latest_version=SceneVersionSummary(
                id=latest_sv.id,
                version_no=latest_sv.version_no,
                status=latest_sv.status,
                score_snapshot=latest_sv.score_snapshot,
                cost_actual=latest_sv.cost_actual,
            ) if latest_sv else None,
        ))

    return EpisodeWithScenesRead(
        id=ep.id,
        project_id=ep.project_id,
        episode_no=ep.episode_no,
        title=ep.title,
        outline=ep.outline,
        script=ep.script,
        duration=ep.duration,
        status=ep.status,
        current_cut_asset_id=ep.current_cut_asset_id,
        created_at=ep.created_at,
        updated_at=ep.updated_at,
        scene_count=len(scenes),
        scenes=scene_list,
    )


@router.patch("/{episode_id}", response_model=EpisodeRead)
async def update_episode(
    episode_id: str,
    body: EpisodeUpdate,
    db: AsyncSession = Depends(get_db)
):
    """更新剧集"""
    episode = await db.get(Episode, episode_id)
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(episode, key, value)
    await db.flush()
    await db.refresh(episode)
    return episode


@router.delete("/{episode_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_episode(episode_id: str, db: AsyncSession = Depends(get_db)):
    """删除剧集"""
    episode = await db.get(Episode, episode_id)
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")
    await db.delete(episode)
    await db.flush()


@router.post("/{episode_id}/mock-produce-scene/{scene_id}")
async def mock_produce_scene(episode_id: str, scene_id: str, db: AsyncSession = Depends(get_db)):
    """启动 mock 场景生产（开发用）"""
    ep = await db.get(Episode, episode_id)
    if not ep:
        raise HTTPException(status_code=404, detail="Episode not found")

    scene = await db.get(Scene, scene_id)
    if not scene or scene.episode_id != episode_id:
        raise HTTPException(status_code=404, detail="Scene not found in this episode")

    job = await start_mock_scene_job(db, scene_id, ep.project_id, episode_id=episode_id)
    return {"data": {"job_id": job.id, "status": job.status, "message": "Mock 生产完成"}}
