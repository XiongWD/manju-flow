"""成本追踪服务

记录和汇总每次 API 调用 / 生成任务的成本。
"""

from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import CostRecord, Episode, Scene


class CostTrackerService:
    """成本追踪服务

    记录和汇总每次 API 调用 / 生成任务的成本。
    """

    # ── 基础 CRUD ────────────────────────────────────────────────────────

    async def record_cost(self, db: AsyncSession, data: dict) -> CostRecord:
        """记录一条成本

        Args:
            data: {project_id, cost_type, provider, model, scene_id?,
                   input_tokens?, output_tokens?, duration_seconds?,
                   api_calls?, retry_count?, cost_usd?, estimated_cost_usd?, metadata_json?}
        """
        record = CostRecord(**data)
        db.add(record)
        await db.flush()
        await db.refresh(record)
        return record

    async def get_scene_costs(self, db: AsyncSession, scene_id: str) -> List[CostRecord]:
        """获取镜头的所有成本记录"""
        stmt = select(CostRecord).where(CostRecord.scene_id == scene_id).order_by(CostRecord.created_at.desc())
        result = await db.execute(stmt)
        return list(result.scalars().all())

    # ── 汇总 ─────────────────────────────────────────────────────────────

    async def get_project_summary(
        self,
        db: AsyncSession,
        project_id: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> dict:
        """项目成本汇总

        Returns:
            {
                "total_cost_usd": float,
                "total_estimated_cost_usd": float,
                "total_api_calls": int,
                "by_type": {"image_generate": {...}, ...},
                "by_provider": {"kling": {...}, ...},
                "by_day": [{"date": "2026-04-30", "cost_usd": 1.23}, ...],
                "record_count": int,
            }
        """
        base = select(CostRecord).where(CostRecord.project_id == project_id)
        if start_date:
            base = base.where(CostRecord.created_at >= _parse_date(start_date))
        if end_date:
            base = base.where(CostRecord.created_at < _next_day(end_date))

        # 所有记录
        records = list((await db.execute(base)).scalars().all())

        total_cost_usd = sum(r.cost_usd or 0 for r in records)
        total_estimated = sum(r.estimated_cost_usd or 0 for r in records)
        total_api_calls = sum(r.api_calls or 1 for r in records)

        by_type: Dict[str, dict] = {}
        by_provider: Dict[str, dict] = {}

        for r in records:
            # by_type
            _agg_into(by_type, r.cost_type, r)
            # by_provider
            if r.provider:
                _agg_into(by_provider, r.provider, r)

        # by_day
        by_day: Dict[str, dict] = {}
        for r in records:
            day_key = r.created_at.strftime("%Y-%m-%d") if r.created_at else "unknown"
            if day_key not in by_day:
                by_day[day_key] = {"cost_usd": 0.0, "estimated_cost_usd": 0.0, "api_calls": 0}
            by_day[day_key]["cost_usd"] += r.cost_usd or 0
            by_day[day_key]["estimated_cost_usd"] += r.estimated_cost_usd or 0
            by_day[day_key]["api_calls"] += r.api_calls or 1

        by_day_list = [
            {"date": k, "cost_usd": v["cost_usd"], "estimated_cost_usd": v["estimated_cost_usd"], "api_calls": v["api_calls"]}
            for k, v in sorted(by_day.items())
        ]

        return {
            "total_cost_usd": total_cost_usd,
            "total_estimated_cost_usd": total_estimated,
            "total_api_calls": total_api_calls,
            "by_type": by_type,
            "by_provider": by_provider,
            "by_day": by_day_list,
            "record_count": len(records),
        }

    async def get_episode_summary(self, db: AsyncSession, episode_id: str) -> dict:
        """剧集成本汇总（汇总剧集下所有 scene 的成本）"""
        # 获取剧集下所有 scene id
        stmt = select(Scene.id).where(Scene.episode_id == episode_id)
        scene_ids = list((await db.execute(stmt)).scalars().all())

        if not scene_ids:
            return {
                "episode_id": episode_id,
                "total_cost_usd": 0.0,
                "total_estimated_cost_usd": 0.0,
                "total_api_calls": 0,
                "scene_count": 0,
                "by_type": {},
                "record_count": 0,
            }

        stmt2 = select(CostRecord).where(CostRecord.scene_id.in_(scene_ids))
        records = list((await db.execute(stmt2)).scalars().all())

        total_cost_usd = sum(r.cost_usd or 0 for r in records)
        total_estimated = sum(r.estimated_cost_usd or 0 for r in records)
        total_api_calls = sum(r.api_calls or 1 for r in records)

        by_type: Dict[str, dict] = {}
        for r in records:
            _agg_into(by_type, r.cost_type, r)

        return {
            "episode_id": episode_id,
            "total_cost_usd": total_cost_usd,
            "total_estimated_cost_usd": total_estimated,
            "total_api_calls": total_api_calls,
            "scene_count": len(scene_ids),
            "by_type": by_type,
            "record_count": len(records),
        }


# ── 内部工具 ──────────────────────────────────────────────────────────────

def _agg_into(bucket: dict, key: str, r: CostRecord) -> None:
    """将一条记录聚合到 bucket[key] 中"""
    if key not in bucket:
        bucket[key] = {
            "total_cost_usd": 0.0,
            "total_estimated_cost_usd": 0.0,
            "count": 0,
            "total_api_calls": 0,
            "total_duration_seconds": 0.0,
        }
    b = bucket[key]
    b["total_cost_usd"] += r.cost_usd or 0
    b["total_estimated_cost_usd"] += r.estimated_cost_usd or 0
    b["count"] += 1
    b["total_api_calls"] += r.api_calls or 1
    b["total_duration_seconds"] += r.duration_seconds or 0


def _parse_date(s: str) -> datetime:
    """解析 YYYY-MM-DD 为 UTC datetime"""
    from datetime import datetime as _dt
    return _dt.strptime(s, "%Y-%m-%d")


def _next_day(s: str) -> datetime:
    """返回 YYYY-MM-DD 次日的 datetime"""
    from datetime import timedelta
    return _parse_date(s) + timedelta(days=1)
