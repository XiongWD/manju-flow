"""Timeline 导出路由"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import async_session_factory
from schemas.timeline import TimelineExportOptions, TimelineExportResponse, TimelineFormat
from services.timeline import TimelineService

router = APIRouter(prefix="/api/episodes/{episode_id}", tags=["timeline"])

_service = TimelineService()


@router.get("/timeline", summary="导出 Timeline")
async def export_timeline(
    episode_id: str,
    format: TimelineFormat = Query(TimelineFormat.json, description="导出格式"),
    include_prompts: bool = Query(False, description="是否包含 prompt_bundle"),
    include_assets: bool = Query(False, description="是否包含资产列表"),
):
    """导出剧集的镜头 Timeline，支持 JSON / CSV 格式"""
    async with async_session_factory() as db:
        # 验证 episode 存在
        from database.models import Episode
        episode = await db.get(Episode, episode_id)
        if not episode:
            raise HTTPException(status_code=404, detail=f"Episode {episode_id} not found")

        if format == TimelineFormat.csv:
            csv_content = await _service.export_csv(db, episode_id)
            filename = f"timeline_{episode_id}.csv"
            return PlainTextResponse(
                content=csv_content,
                media_type="text/csv; charset=utf-8",
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"'
                },
            )

        # JSON
        data = await _service.export_json(
            db, episode_id,
            include_prompts=include_prompts,
            include_assets=include_assets,
        )
        return data
