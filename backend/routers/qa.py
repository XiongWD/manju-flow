"""QA 路由 — 实际实现"""
import logging


from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_db
from database.models import QARun, QAIssue


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/qa", tags=["qa"])


@router.get("/runs")
async def list_qa_runs(
    project_id: str = Query(None),
    subject_type: str = Query(None),
    subject_id: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """获取 QA 运行列表"""
    skip = (page - 1) * page_size
    limit = min(page_size, 200)
    q = select(QARun)
    if project_id:
        q = q.where(QARun.project_id == project_id)
    if subject_type and subject_id:
        q = q.where(QARun.subject_type == subject_type, QARun.subject_id == subject_id)
    # count
    total_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_result.scalar() or 0
    q = q.order_by(QARun.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    runs = result.scalars().all()

    return {
        "items": [
            {
                "id": r.id,
                "project_id": r.project_id,
                "gate_code": r.gate_code,
                "subject_type": r.subject_type,
                "subject_id": r.subject_id,
                "step_key": r.step_key,
                "status": r.status,
                "score_json": r.score_json,
                "threshold_snapshot": r.threshold_snapshot,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "finished_at": r.finished_at.isoformat() if r.finished_at else None,
            }
            for r in runs
        ],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/runs/{run_id}")
async def get_qa_run(run_id: str, db: AsyncSession = Depends(get_db)):
    """获取 QA 运行详情（含 issues）"""
    run = await db.get(QARun, run_id)
    if not run:
        raise HTTPException(404, "QA Run not found")

    issues_q = select(QAIssue).where(QAIssue.qa_run_id == run_id)
    issues_result = await db.execute(issues_q)
    issues = issues_result.scalars().all()

    return {
        "data": {
            "id": run.id,
            "project_id": run.project_id,
            "gate_code": run.gate_code,
            "subject_type": run.subject_type,
            "subject_id": run.subject_id,
            "step_key": run.step_key,
            "status": run.status,
            "score_json": run.score_json,
            "threshold_snapshot": run.threshold_snapshot,
            "created_at": run.created_at.isoformat() if run.created_at else None,
            "finished_at": run.finished_at.isoformat() if run.finished_at else None,
            "issues": [
                {
                    "id": i.id,
                    "issue_code": i.issue_code,
                    "severity": i.severity,
                    "message": i.message,
                    "suggested_action": i.suggested_action,
                    "created_at": i.created_at.isoformat() if i.created_at else None,
                }
                for i in issues
            ],
        }
    }


@router.get("/issues")
async def list_qa_issues(
    project_id: str = Query(None),
    severity: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """获取 QA 问题列表"""
    skip = (page - 1) * page_size
    limit = min(page_size, 200)
    q = select(QAIssue)
    if project_id:
        q = q.where(QAIssue.project_id == project_id)
    if severity:
        q = q.where(QAIssue.severity == severity)
    # count
    total_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_result.scalar() or 0
    q = q.order_by(QAIssue.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    issues = result.scalars().all()

    return {
        "items": [
            {
                "id": i.id,
                "qa_run_id": i.qa_run_id,
                "issue_code": i.issue_code,
                "severity": i.severity,
                "message": i.message,
                "suggested_action": i.suggested_action,
                "related_scene_version_id": i.related_scene_version_id,
                "created_at": i.created_at.isoformat() if i.created_at else None,
            }
            for i in issues
        ],
        "total": total,
        "skip": skip,
        "limit": limit,
    }
