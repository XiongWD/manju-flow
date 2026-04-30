
logger = logging.getLogger(__name__)
"""静帧候选路由 — 状态机 + 视频生成阻断"""
import logging


from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_db
from database.models import Scene, StillCandidate
from schemas.still import (

    StillCandidateCreate,
    StillCandidateUpdate,
    StillCandidateResponse,
    StillLockRequest,
)

router = APIRouter(tags=["stills"])

# shot_stage 状态顺序，用于判断阶段先后
_STAGE_ORDER = [
    "draft", "script_parsed", "still_generating", "still_review",
    "still_locked", "video_generating", "video_review",
    "video_locked", "compose_ready", "delivery",
]


def _stage_index(stage: str) -> int:
    try:
        return _STAGE_ORDER.index(stage)
    except ValueError:
        return -1


# ─── 状态转换规则 ───────────────────────────────────────────────────────────
# 提交候选：scene 存在，shot_stage 为 still_generating 或 still_review → 推进到 still_review
# 审核候选：status 改为 approved/rejected，记录审核信息
# 锁定静帧：至少一个 approved 候选 → 推进到 still_locked，更新 locked_still_id
# 视频生成提交：shot_stage ≥ still_locked 才允许


@router.post("/api/scenes/{scene_id}/still-candidates", status_code=status.HTTP_201_CREATED)
async def create_still_candidate(
    scene_id: str,
    body: StillCandidateCreate,
    db: AsyncSession = Depends(get_db),
):
    """提交静帧候选

    前置条件：scene 存在且 shot_stage 为 still_generating 或 still_review。
    自动将 shot_stage 推进到 still_review。
    """
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(404, f"Scene {scene_id} not found")

    if scene.shot_stage not in ("still_generating", "still_review"):
        raise HTTPException(
            409,
            f"Scene {scene_id} 当前阶段为 {scene.shot_stage}，无法提交静帧候选。"
            f"需要 shot_stage 为 still_generating 或 still_review。",
        )

    # 自动递增版本号
    max_ver_q = select(StillCandidate.version).where(
        StillCandidate.scene_id == scene_id
    ).order_by(StillCandidate.version.desc()).limit(1)
    result = await db.execute(max_ver_q)
    max_ver = result.scalar() or 0

    candidate = StillCandidate(
        scene_id=scene_id,
        version=max_ver + 1,
        image_path=body.image_path,
        thumbnail_path=body.thumbnail_path,
        prompt_used=body.prompt_used,
        seed=body.seed,
    )
    db.add(candidate)

    # 推进 shot_stage 到 still_review
    if scene.shot_stage == "still_generating":
        scene.shot_stage = "still_review"

    await db.commit()
    await db.refresh(candidate)

    return {"data": StillCandidateResponse.model_validate(candidate).model_dump()}


@router.get("/api/scenes/{scene_id}/still-candidates")
async def list_still_candidates(
    scene_id: str,
    db: AsyncSession = Depends(get_db),
):
    """获取镜头的静帧候选列表
    # 分页豁免：列表固定小
    """
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(404, f"Scene {scene_id} not found")

    q = select(StillCandidate).where(
        StillCandidate.scene_id == scene_id
    ).order_by(StillCandidate.version.desc())
    result = await db.execute(q)
    candidates = result.scalars().all()

    return {
        "data": [
            StillCandidateResponse.model_validate(c).model_dump()
            for c in candidates
        ]
    }


@router.get("/api/still-candidates/{candidate_id}")
async def get_still_candidate(
    candidate_id: str,
    db: AsyncSession = Depends(get_db),
):
    """获取候选详情"""
    candidate = await db.get(StillCandidate, candidate_id)
    if not candidate:
        raise HTTPException(404, f"StillCandidate {candidate_id} not found")

    return {"data": StillCandidateResponse.model_validate(candidate).model_dump()}


@router.put("/api/still-candidates/{candidate_id}")
async def update_still_candidate(
    candidate_id: str,
    body: StillCandidateUpdate,
    db: AsyncSession = Depends(get_db),
):
    """更新候选（审核 approve/reject）

    记录 review_note/reviewed_by/reviewed_at。
    """
    candidate = await db.get(StillCandidate, candidate_id)
    if not candidate:
        raise HTTPException(404, f"StillCandidate {candidate_id} not found")

    if body.status:
        if candidate.status not in ("pending", "approved", "rejected"):
            raise HTTPException(409, f"候选当前状态 {candidate.status} 不允许审核")
        candidate.status = body.status
        candidate.reviewed_at = datetime.utcnow()

    if body.review_note is not None:
        candidate.review_note = body.review_note

    await db.commit()
    await db.refresh(candidate)

    return {"data": StillCandidateResponse.model_validate(candidate).model_dump()}


@router.post("/api/scenes/{scene_id}/lock-still")
async def lock_still(
    scene_id: str,
    body: StillLockRequest,
    db: AsyncSession = Depends(get_db),
):
    """锁定已审核通过的静帧

    前置条件：指定候选存在且状态为 approved。
    将 shot_stage 推进到 still_locked，更新 scene.locked_still_id。
    """
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(404, f"Scene {scene_id} not found")

    candidate = await db.get(StillCandidate, body.candidate_id)
    if not candidate or candidate.scene_id != scene_id:
        raise HTTPException(404, f"StillCandidate {body.candidate_id} not found in scene {scene_id}")

    if candidate.status != "approved":
        raise HTTPException(
            409,
            f"StillCandidate {body.candidate_id} 状态为 {candidate.status}，只有 approved 的候选可以锁定。",
        )

    scene.locked_still_id = body.candidate_id
    scene.shot_stage = "still_locked"

    await db.commit()

    # 触发状态向上传播
    from services.status_propagation import StatusPropagationService
    propagation = StatusPropagationService()
    await propagation.propagate_scene_change(db, scene_id)

    return {
        "data": {
            "scene_id": scene_id,
            "locked_still_id": body.candidate_id,
            "shot_stage": scene.shot_stage,
        }
    }


@router.get("/api/scenes/{scene_id}/locked-still")
async def get_locked_still(
    scene_id: str,
    db: AsyncSession = Depends(get_db),
):
    """获取当前锁定的静帧"""
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(404, f"Scene {scene_id} not found")

    if not scene.locked_still_id:
        raise HTTPException(404, f"Scene {scene_id} 没有锁定的静帧")

    candidate = await db.get(StillCandidate, scene.locked_still_id)
    if not candidate:
        raise HTTPException(404, f"锁定的静帧候选 {scene.locked_still_id} 不存在")

    return {"data": StillCandidateResponse.model_validate(candidate).model_dump()}
