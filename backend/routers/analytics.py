"""数据分析路由 — stub"""

from fastapi import APIRouter

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/snapshots")
async def list_analytics_snapshots():
    """获取分析快照列表（stub）"""
    return {"message": "analytics snapshots list — 待实现", "data": []}


@router.get("/cost")
async def get_cost_summary():
    """获取成本汇总（stub）"""
    return {"message": "cost summary — 待实现", "data": {"total": 0}}
