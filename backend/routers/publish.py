"""发布路由 — stub"""

from fastapi import APIRouter

router = APIRouter(prefix="/api/publish", tags=["publish"])


@router.get("/jobs")
async def list_publish_jobs():
    """获取发布任务列表（stub）"""
    return {"message": "publish jobs list — 待实现", "data": []}


@router.get("/jobs/{job_id}")
async def get_publish_job(job_id: str):
    """获取单个发布任务（stub）"""
    return {"message": f"publish job {job_id} — 待实现", "data": None}


@router.get("/variants")
async def list_publish_variants():
    """获取平台变体列表（stub）"""
    return {"message": "publish variants list — 待实现", "data": []}
