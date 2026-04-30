
logger = logging.getLogger(__name__)
"""镜头复杂度评分路由"""
import logging


from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_db
from database.models import Scene, ComplexityProfile
from schemas.complexity import (

    ComplexityEpisodeSummary,
    ComplexityProfileResponse,
    ComplexitySceneItem,
)
from services.complexity import ComplexityService

router = APIRouter(prefix="/api", tags=["complexity"])

_svc = ComplexityService()


@router.get(
    "/scenes/{scene_id}/complexity",
    response_model=ComplexityProfileResponse,
    summary="获取或自动计算镜头复杂度",
)
async def get_scene_complexity(
    scene_id: str, db: AsyncSession = Depends(get_db)
):
    """返回镜头复杂度评分；如不存在则自动计算。"""
    # 验证 scene 存在
    scene = await db.execute(select(Scene).where(Scene.id == scene_id))
    if scene.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail=f"Scene {scene_id} not found")

    profile = await _svc.get_or_calculate(db, scene_id)
    return profile


@router.post(
    "/scenes/{scene_id}/complexity/recalculate",
    response_model=ComplexityProfileResponse,
    summary="强制重新计算镜头复杂度",
)
async def recalculate_scene_complexity(
    scene_id: str, db: AsyncSession = Depends(get_db)
):
    """强制重新计算镜头复杂度评分。"""
    # 验证 scene 存在
    scene = await db.execute(select(Scene).where(Scene.id == scene_id))
    if scene.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail=f"Scene {scene_id} not found")

    profile = await _svc.calculate(db, scene_id)
    return profile


@router.get(
    "/episodes/{episode_id}/complexity-summary",
    response_model=ComplexityEpisodeSummary,
    summary="剧集镜头复杂度汇总",
)
async def get_episode_complexity_summary(
    episode_id: str, db: AsyncSession = Depends(get_db)
):
    """返回剧集下所有镜头的复杂度汇总：平均分、最高分、镜头列表。"""
    # 获取该 episode 下所有 scenes（含 complexity profile）
    result = await db.execute(
        select(Scene)
        .where(Scene.episode_id == episode_id)
        .order_by(Scene.scene_no)
    )
    scenes = list(result.scalars().all())

    if not scenes:
        return ComplexityEpisodeSummary(
            episode_id=episode_id,
            scene_count=0,
            avg_score=0.0,
            max_score=0.0,
            min_score=0.0,
            scenes=[],
        )

    # 获取所有 complexity profiles
    scene_ids = [s.id for s in scenes]
    profile_result = await db.execute(
        select(ComplexityProfile).where(
            ComplexityProfile.scene_id.in_(scene_ids)
        )
    )
    profiles = {p.scene_id: p for p in profile_result.scalars().all()}

    scene_map = {s.id: s for s in scenes}

    items: list[ComplexitySceneItem] = []
    scores: list[float] = []

    for sid in scene_ids:
        prof = profiles.get(sid)
        sc = scene_map[sid]
        if prof:
            score = prof.overall_score
            items.append(
                ComplexitySceneItem(
                    scene_id=sid,
                    scene_no=sc.scene_no,
                    title=sc.title,
                    overall_score=score,
                    character_count=prof.character_count,
                    has_location=prof.has_location,
                )
            )
            scores.append(score)

    if scores:
        return ComplexityEpisodeSummary(
            episode_id=episode_id,
            scene_count=len(items),
            avg_score=round(sum(scores) / len(scores), 2),
            max_score=round(max(scores), 2),
            min_score=round(min(scores), 2),
            scenes=items,
        )

    return ComplexityEpisodeSummary(
        episode_id=episode_id,
        scene_count=len(scenes),
        avg_score=0.0,
        max_score=0.0,
        min_score=0.0,
        scenes=[],
    )


