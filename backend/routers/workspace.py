"""Workspace 聚合路由 — 首屏聚合数据（面向 frontend-next）"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_db
from database.models import Project, Episode, Scene, Asset
from schemas.workspace import WorkspaceOverview, ProjectSummary, EpisodeSummary, SceneSummary, ProjectWorkspace

router = APIRouter(prefix="/api/workspace", tags=["workspace"])


@router.get("/overview", response_model=WorkspaceOverview)
async def get_workspace_overview(
    project_id: str = Query(None, description="筛选特定项目"),
    limit_projects: int = Query(10, le=50, description="返回项目数量"),
    limit_episodes: int = Query(10, le=50, description="返回剧集数量"),
    limit_scenes: int = Query(20, le=100, description="返回场景数量"),
    db: AsyncSession = Depends(get_db),
):
    """
    获取工作区概览 — 首屏聚合数据

    返回：
    - 最近的项目列表
    - 最近的剧集列表
    - 最近的场景列表
    - 统计信息
    """
    # 获取项目列表
    projects_q = select(Project).order_by(Project.created_at.desc()).limit(limit_projects)
    if project_id:
        projects_q = projects_q.where(Project.id == project_id)
    projects_result = await db.execute(projects_q)
    projects = projects_result.scalars().all()

    # 获取剧集列表
    episodes_q = (
        select(Episode)
        .order_by(Episode.updated_at.desc())
        .limit(limit_episodes)
    )
    if project_id:
        episodes_q = episodes_q.where(Episode.project_id == project_id)
    episodes_result = await db.execute(episodes_q)
    episodes = episodes_result.scalars().all()

    # 获取场景列表
    scenes_q = (
        select(Scene)
        .order_by(Scene.updated_at.desc())
        .limit(limit_scenes)
    )
    if project_id:
        # 如果指定了项目，需要通过 episodes 关联
        scenes_q = (
            scenes_q.join(Episode, Episode.id == Scene.episode_id)
            .where(Episode.project_id == project_id)
        )
    scenes_result = await db.execute(scenes_q)
    scenes = scenes_result.scalars().all()

    # 统计信息
    total_projects = await db.scalar(select(func.count(Project.id)))
    total_episodes = await db.scalar(select(func.count(Episode.id)))
    total_scenes = await db.scalar(select(func.count(Scene.id)))
    total_assets = await db.scalar(select(func.count(Asset.id)))

    # 统计各项目下的集数和场景数
    project_summaries = []
    for project in projects:
        episode_count = await db.scalar(
            select(func.count(Episode.id)).where(Episode.project_id == project.id)
        )
        project_summaries.append(
            ProjectSummary(
                id=project.id,
                name=project.name,
                genre=project.genre,
                status=project.status,
                episode_count=episode_count,
                created_at=project.created_at,
            )
        )

    # 剧集摘要（含场景数）
    episode_summaries = []
    for episode in episodes:
        scene_count = await db.scalar(
            select(func.count(Scene.id)).where(Scene.episode_id == episode.id)
        )
        episode_summaries.append(
            EpisodeSummary(
                id=episode.id,
                project_id=episode.project_id,
                episode_no=episode.episode_no,
                title=episode.title,
                status=episode.status,
                scene_count=scene_count,
            )
        )

    # 场景摘要
    scene_summaries = [
        SceneSummary(
            id=s.id,
            episode_id=s.episode_id,
            scene_no=s.scene_no,
            title=s.title,
            status=s.status,
        )
        for s in scenes
    ]

    return WorkspaceOverview(
        projects=project_summaries,
        recent_episodes=episode_summaries,
        recent_scenes=scene_summaries,
        stats={
            "total_projects": total_projects,
            "total_episodes": total_episodes,
            "total_scenes": total_scenes,
            "total_assets": total_assets,
        },
    )


@router.get("/projects/{project_id}", response_model=ProjectWorkspace)
async def get_project_workspace(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    获取单个项目的工作区聚合数据

    返回：
    - 项目基本信息
    - 项目下的所有剧集
    - 项目下的所有场景
    - 项目资产数量
    """
    # 获取项目
    project = await db.get(Project, project_id)
    if not project:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="项目不存在")

    # 获取项目下的剧集
    episodes_q = (
        select(Episode)
        .where(Episode.project_id == project_id)
        .order_by(Episode.episode_no)
    )
    episodes_result = await db.execute(episodes_q)
    episodes = episodes_result.scalars().all()

    # 获取项目下的场景（通过 episodes）
    scenes_q = (
        select(Scene)
        .join(Episode, Episode.id == Scene.episode_id)
        .where(Episode.project_id == project_id)
        .order_by(Episode.episode_no, Scene.scene_no)
    )
    scenes_result = await db.execute(scenes_q)
    scenes = scenes_result.scalars().all()

    # 统计资产数量
    asset_count = await db.scalar(
        select(func.count(Asset.id)).where(Asset.project_id == project_id)
    )

    # 构建返回数据
    return ProjectWorkspace(
        project=ProjectSummary(
            id=project.id,
            name=project.name,
            genre=project.genre,
            status=project.status,
            episode_count=len(episodes),
            created_at=project.created_at,
        ),
        episodes=[
            EpisodeSummary(
                id=ep.id,
                project_id=ep.project_id,
                episode_no=ep.episode_no,
                title=ep.title,
                status=ep.status,
                scene_count=0,  # 已在 scenes 中
            )
            for ep in episodes
        ],
        scenes=[
            SceneSummary(
                id=s.id,
                episode_id=s.episode_id,
                scene_no=s.scene_no,
                title=s.title,
                status=s.status,
            )
            for s in scenes
        ],
        asset_count=asset_count or 0,
    )
