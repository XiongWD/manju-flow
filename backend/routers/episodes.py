"""剧集路由 — 完整 CRUD 实现"""
import logging


from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_db
from database.models import Episode, Scene, SceneVersion
from schemas.episode import EpisodeCreate, EpisodeUpdate, EpisodeRead, EpisodeWithScenesRead, LockSceneVersionRequest, LockSceneVersionResponse
from schemas.rule import RulesReportResponse, RulesReportSummary, RuleExecutionResult
from schemas.scene import SceneWithVersionSummary, SceneVersionSummary
from services.pipeline.orchestrator import start_mock_scene_job
from services.pipeline.tier_config import resolve_episode_tier
from services.pipeline.version_lock import VersionLockService
from services.broadcast import broadcast
from database.models import QARun, QAIssue


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/episodes", tags=["episodes"])


@router.get("/")
async def list_episodes(
    project_id: str = Query(None, description="项目 ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1),
    search: str = Query("", description="搜索关键词"),
    db: AsyncSession = Depends(get_db),
):
    """获取剧集列表"""
    limit = min(limit, 200)
    q = select(Episode)
    if project_id:
        q = q.where(Episode.project_id == project_id)
    if search:
        q = q.filter(or_(
            Episode.title.ilike(f"%{search}%"),
            Episode.outline.ilike(f"%{search}%"),
        ))
    # count
    total_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_result.scalar() or 0
    q = q.order_by(Episode.episode_no).offset(skip).limit(limit)
    result = await db.execute(q)
    items = result.scalars().all()
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.post("/", response_model=EpisodeRead, status_code=status.HTTP_201_CREATED)
async def create_episode(body: EpisodeCreate, db: AsyncSession = Depends(get_db)):
    """创建剧集"""
    episode = Episode(**body.model_dump())
    db.add(episode)
    await db.flush()
    await db.refresh(episode)
    await broadcast.broadcast(f"project:{episode.project_id}", {"type": "created", "entity": "episode", "id": episode.id})
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

    tier_info = await resolve_episode_tier(db, episode=ep)

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
        effective_tier=tier_info["tier"],
        tier_source=tier_info["source"],
    )


@router.patch("/{episode_id}", response_model=EpisodeRead)
async def update_episode(
    episode_id: str,
    body: EpisodeUpdate,
    db: AsyncSession = Depends(get_db)
):
    """更新剧集"""
    result = await db.execute(select(Episode).where(Episode.id == episode_id))
    episode = result.scalar_one_or_none()
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(episode, key, value)
    await db.flush()
    await db.refresh(episode)
    await broadcast.broadcast(f"project:{episode.project_id}", {"type": "updated", "entity": "episode", "id": episode_id})
    return episode


@router.delete("/{episode_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_episode(episode_id: str, db: AsyncSession = Depends(get_db)):
    """删除剧集"""
    result = await db.execute(select(Episode).where(Episode.id == episode_id))
    episode = result.scalar_one_or_none()
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")
    await db.delete(episode)
    await db.flush()
    await broadcast.broadcast(f"project:{episode.project_id}", {"type": "deleted", "entity": "episode", "id": episode_id})


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


@router.post("/lock-scene-version", response_model=LockSceneVersionResponse)
async def lock_scene_version(
    body: LockSceneVersionRequest,
    db: AsyncSession = Depends(get_db)
):
    """显式锁定场景版本（需要人工确认）

    039a：提供显式 lock 切换 API，替代自动锁定逻辑。
    场景版本必须处于 QA_PASSED 或 READY_TO_LOCK 状态才能锁定。
    如果场景已有 locked_version_id，需要 force=True 才能覆盖。
    """
    try:
        scene = await VersionLockService.explicit_lock_version(
            db=db,
            scene_id=body.scene_id,
            scene_version_id=body.scene_version_id,
            force=body.force,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

    await db.commit()
    await db.refresh(scene)

    return LockSceneVersionResponse(
        scene_id=scene.id,
        locked_version_id=scene.locked_version_id,
        status="LOCKED"
    )


@router.get("/{episode_id}/rules-report", response_model=RulesReportResponse)
async def get_episode_rules_report(
    episode_id: str,
    db: AsyncSession = Depends(get_db),
):
    """041a.4: 获取剧集维度的规则合规报告

    聚合 episode 及其下属 scene / scene_version 的 qa_runs，
    将每个 qa_run 映射为 RuleExecutionResult。

    降级策略：
    - rule_id: 从 gate_code 推导（如 G1a → "gate-G1a"）
    - platform / auto_checkable / manual_review_required: 从 qa_run 数据推导
    - evidence: 来自 score_json / threshold_snapshot
    - failure_reason: 从关联 qa_issues 聚合
    """
    ep = await db.get(Episode, episode_id)
    if not ep:
        raise HTTPException(status_code=404, detail="Episode not found")

    # 收集 episode 下所有 subject_id
    subject_ids = [episode_id]
    scenes_q = select(Scene.id).where(Scene.episode_id == episode_id)
    scenes_result = await db.execute(scenes_q)
    subject_ids.extend(row[0] for row in scenes_result.all())

    # 查询所有相关 qa_runs
    qa_runs_q = (
        select(QARun)
        .where(QARun.subject_id.in_(subject_ids))
        .order_by(QARun.created_at.desc())
    )
    qa_runs_result = await db.execute(qa_runs_q)
    qa_runs = qa_runs_result.scalars().all()

    results: list[RuleExecutionResult] = []
    block_count = 0
    flag_count = 0
    manual_review_count = 0

    for run in qa_runs:
        # 推导 severity
        severity = "BLOCK" if run.status == "failed" else "FLAG"
        if severity == "BLOCK":
            block_count += 1
        else:
            flag_count += 1

        passed = run.status == "passed"
        needs_review = run.status == "needs_review"
        if needs_review:
            manual_review_count += 1

        # 收集关联 issue ids
        issue_ids: list[str] = []
        failure_reasons: list[str] = []
        if run.issues:
            for issue in run.issues:
                issue_ids.append(issue.id)
                failure_reasons.append(f"[{issue.issue_code}] {issue.message}")

        # 构建 evidence
        evidence: dict = {}
        if run.score_json:
            evidence["score"] = run.score_json
        if run.threshold_snapshot:
            evidence["threshold"] = run.threshold_snapshot

        results.append(RuleExecutionResult(
            rule_id=f"gate-{run.gate_code}",
            platform=ep.project_id or "unknown",
            subject_type=run.subject_type,
            subject_id=run.subject_id,
            passed=passed,
            severity=severity,
            auto_checkable=True,
            manual_review_required=needs_review,
            evidence=evidence or None,
            failure_reason="; ".join(failure_reasons) or None,
            qa_run_id=run.id,
            qa_issue_ids=issue_ids,
        ))

    summary = RulesReportSummary(
        total=len(results),
        passed=sum(1 for r in results if r.passed),
        failed=sum(1 for r in results if not r.passed),
        block_count=block_count,
        flag_count=flag_count,
        manual_review_count=manual_review_count,
    )

    return RulesReportResponse(results=results, summary=summary)
