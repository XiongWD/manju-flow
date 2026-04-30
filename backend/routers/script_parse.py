
"""剧本解析路由"""
import logging
logger = logging.getLogger(__name__)


from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_db
from database.models import Episode, ScriptIssue, ScriptParseReport, ShotImportReport
from schemas.script_parse import (

    ScriptParseReportRead,
    ScriptParseRequest,
    ScriptParseResponse,
    ScriptIssueRead,
    ShotImportReportRead,
)
from services.script_parser import ScriptParser

router = APIRouter(prefix="/api", tags=["script-parse"])


@router.post(
    "/episodes/{episode_id}/parse-script",
    response_model=ScriptParseResponse,
)
async def parse_script(
    episode_id: str,
    body: Optional[ScriptParseRequest] = None,
    db: AsyncSession = Depends(get_db),
):
    """解析剧本并生成报告（不自动创建 Scene）"""
    # 加载 episode
    episode = await db.get(Episode, episode_id)
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")

    script_text = body.script_text if body and body.script_text else episode.script
    if not script_text or not script_text.strip():
        raise HTTPException(status_code=400, detail="No script text available")

    parser = ScriptParser(db=db, project_id=episode.project_id)
    report, shot_reports, issues = await parser.parse_episode_script(
        episode_id=episode_id,
        script_text=script_text,
    )

    db.add(report)
    db.add_all(shot_reports)
    db.add_all(issues)
    await db.commit()

    # refresh
    for obj in [report] + shot_reports + issues:
        await db.refresh(obj)

    return ScriptParseResponse(
        parse_report=ScriptParseReportRead.model_validate(report),
        shot_reports=[ShotImportReportRead.model_validate(s) for s in shot_reports],
        issues=[ScriptIssueRead.model_validate(i) for i in issues],
    )


@router.get(
    "/episodes/{episode_id}/parse-reports",
    response_model=list[ScriptParseReportRead],
)
async def list_parse_reports(
    episode_id: str,
    db: AsyncSession = Depends(get_db),
):
    """获取某个 episode 的所有解析历史
    # 分页豁免：列表固定小
    """
    episode = await db.get(Episode, episode_id)
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")

    result = await db.execute(
        select(ScriptParseReport)
        .where(ScriptParseReport.episode_id == episode_id)
        .order_by(ScriptParseReport.created_at.desc())
    )
    reports = result.scalars().all()
    return [ScriptParseReportRead.model_validate(r) for r in reports]


@router.get(
    "/parse-reports/{report_id}",
    response_model=ScriptParseResponse,
)
async def get_parse_report(
    report_id: str,
    db: AsyncSession = Depends(get_db),
):
    """获取单个解析报告详情（含 shot reports + issues）"""
    report = await db.get(ScriptParseReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Parse report not found")

    shot_result = await db.execute(
        select(ShotImportReport)
        .where(ShotImportReport.parse_report_id == report_id)
        .order_by(ShotImportReport.shot_no)
    )
    shot_reports = shot_result.scalars().all()

    issue_result = await db.execute(
        select(ScriptIssue)
        .where(ScriptIssue.parse_report_id == report_id)
        .order_by(ScriptIssue.line_number)
    )
    issues = issue_result.scalars().all()

    return ScriptParseResponse(
        parse_report=ScriptParseReportRead.model_validate(report),
        shot_reports=[ShotImportReportRead.model_validate(s) for s in shot_reports],
        issues=[ScriptIssueRead.model_validate(i) for i in issues],
    )
