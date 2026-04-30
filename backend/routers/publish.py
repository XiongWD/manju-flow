
logger = logging.getLogger(__name__)
"""发布 & 交付路由 — 041b2

API 端点：
- POST   /api/publish/jobs                     创建发布任务
- GET    /api/publish/jobs                     列出发布任务
- GET    /api/publish/jobs/{job_id}            获取发布任务详情
- POST   /api/publish/jobs/{job_id}/transition 状态流转
- POST   /api/publish/delivery-packages        创建交付包
- GET    /api/publish/delivery-packages        列出交付包
- GET    /api/publish/delivery-packages/{id}   获取交付包详情
- POST   /api/publish/delivery-packages/{id}/variants  创建平台变体
- GET    /api/publish/variants                 列出平台变体
"""
import logging


from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import async_session_factory
from database.models import DeliveryPackage, PublishJob, PublishVariant
from schemas.delivery import (

    DeliveryPackageRead,
    DeliveryPackageSummary,
    DeliveryPackageWithVariantsRead,
    ExportRecheckRead,
    ExportRecheckRequest,
    PlatformVariantRead,
)
from schemas.publish import (
    PublishJobCreate,
    PublishJobRead,
    PublishJobSummary,
)
from services.pipeline.delivery import DeliveryPackageBuilder
from services.pipeline.export_recheck import ExportRechecker
from services.pipeline.publish import PublishJobService

router = APIRouter(prefix="/api/publish", tags=["publish"])


async def _get_db() -> AsyncSession:
    async with async_session_factory() as session:
        yield session


# ── Delivery Packages ───────────────────────────────────────────────────

class CreateDeliveryPackageRequest(BaseModel):
    episode_id: str = Field(..., description="剧集 ID")
    publish_job_id: Optional[str] = Field(None, description="关联发布任务 ID")


class CreateVariantRequest(BaseModel):
    platform: str = Field(..., max_length=32, description="目标平台")
    resolution: Optional[str] = Field(None, max_length=32, description="分辨率")
    aspect_ratio: Optional[str] = Field(None, max_length=16, description="画面比例")
    bitrate: Optional[str] = Field(None, max_length=32, description="码率")


@router.post("/delivery-packages", response_model=DeliveryPackageRead)
async def create_delivery_package(
    req: CreateDeliveryPackageRequest,
    db: AsyncSession = Depends(_get_db),
):
    """创建交付包 — 从 episode 已锁定版本收集资产"""
    try:
        builder = DeliveryPackageBuilder(db)
        pkg = await builder.build(
            episode_id=req.episode_id,
            publish_job_id=req.publish_job_id,
        )
        await db.commit()
        return pkg
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Build failed: {e}")


@router.get("/delivery-packages")
async def list_delivery_packages(
    episode_id: Optional[str] = Query(None, description="按剧集筛选"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1),
    db: AsyncSession = Depends(_get_db),
):
    """列出交付包"""
    limit = min(limit, 200)
    stmt = select(DeliveryPackage)
    if episode_id:
        stmt = stmt.where(DeliveryPackage.episode_id == episode_id)
    total_result = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = total_result.scalar() or 0
    stmt = stmt.order_by(DeliveryPackage.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    items = result.scalars().all()
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.get("/delivery-packages/{pkg_id}", response_model=DeliveryPackageWithVariantsRead)
async def get_delivery_package(
    pkg_id: str,
    db: AsyncSession = Depends(_get_db),
):
    """获取交付包详情（含平台变体）"""
    stmt = select(DeliveryPackage).where(DeliveryPackage.id == pkg_id)
    result = await db.execute(stmt)
    pkg = result.scalar_one_or_none()
    if not pkg:
        raise HTTPException(status_code=404, detail="DeliveryPackage not found")

    # 查关联变体
    v_stmt = select(PublishVariant).where(
        PublishVariant.delivery_package_id == pkg_id
    )
    v_result = await db.execute(v_stmt)
    variants = v_result.scalars().all()

    return DeliveryPackageWithVariantsRead(
        **{c.name: getattr(pkg, c.name) for c in pkg.__table__.columns},
        variants=variants,
    )


@router.post("/delivery-packages/{pkg_id}/variants", response_model=PlatformVariantRead)
async def create_platform_variant(
    pkg_id: str,
    req: CreateVariantRequest,
    db: AsyncSession = Depends(_get_db),
):
    """为交付包创建平台变体"""
    try:
        builder = DeliveryPackageBuilder(db)
        variant = await builder.create_variant(
            delivery_package_id=pkg_id,
            platform=req.platform,
            resolution=req.resolution,
            aspect_ratio=req.aspect_ratio,
            bitrate=req.bitrate,
        )
        await db.commit()
        return variant
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Variant creation failed: {e}")


# ── Export Recheck (042c) ─────────────────────────────────────────────────

@router.post("/delivery-packages/{pkg_id}/recheck", response_model=ExportRecheckRead)
async def recheck_delivery_package(
    pkg_id: str,
    req: ExportRecheckRequest = ExportRecheckRequest(),
    db: AsyncSession = Depends(_get_db),
):
    """导出后重验 — 对交付包资产重新执行平台规则检查

    流程：
    1. 收集交付包内所有资产
    2. 逐资产执行 RuleExecutor（目标平台规则）
    3. 结果写入 qa_runs + qa_issues（gate_code=EXPORT_RECHECK）
    4. 回写 delivery_package / publish_variant / publish_job
    """
    try:
        rechecker = ExportRechecker(db)
        result = await rechecker.recheck_package(
            delivery_package_id=pkg_id,
            platform=req.platform,
        )
        await db.commit()
        return ExportRecheckRead(**result)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Recheck failed: {e}")


# ── Platform Variants ───────────────────────────────────────────────────

@router.get("/variants")
async def list_platform_variants(
    delivery_package_id: Optional[str] = Query(None, description="按交付包筛选"),
    platform: Optional[str] = Query(None, description="按平台筛选"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1),
    db: AsyncSession = Depends(_get_db),
):
    """列出平台变体"""
    limit = min(limit, 200)
    stmt = select(PublishVariant)
    if delivery_package_id:
        stmt = stmt.where(PublishVariant.delivery_package_id == delivery_package_id)
    if platform:
        stmt = stmt.where(PublishVariant.platform == platform)
    total_result = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = total_result.scalar() or 0
    stmt = stmt.order_by(PublishVariant.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    items = result.scalars().all()
    return {"items": items, "total": total, "skip": skip, "limit": limit}


# ── Publish Jobs ──────────────────────────────────────────────────────

class TransitionRequest(BaseModel):
    target_status: str = Field(..., description="目标状态（running/success/failed/cancelled）")
    error_message: Optional[str] = Field(None, description="失败时的错误信息")


@router.post("/jobs", response_model=PublishJobRead)
async def create_publish_job(
    req: PublishJobCreate,
    db: AsyncSession = Depends(_get_db),
):
    """创建发布任务

    发布链入口：创建 job → 关联 delivery_package → 创建 variants → transition
    """
    try:
        svc = PublishJobService(db)
        job = await svc.create(
            episode_id=req.episode_id,
            platform=req.platform,
            scheduled_at=req.scheduled_at,
            payload_json=req.payload_json,
        )
        await db.commit()
        return job
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create publish job: {e}")


@router.get("/jobs")
async def list_publish_jobs(
    episode_id: Optional[str] = Query(None, description="按剧集筛选"),
    status: Optional[str] = Query(None, description="按状态筛选"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1),
    db: AsyncSession = Depends(_get_db),
):
    """列出发布任务"""
    limit = min(limit, 200)
    stmt = select(PublishJob)
    if episode_id:
        stmt = stmt.where(PublishJob.episode_id == episode_id)
    if status:
        stmt = stmt.where(PublishJob.status == status)
    total_result = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = total_result.scalar() or 0
    stmt = stmt.order_by(PublishJob.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    items = result.scalars().all()
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.get("/jobs/{job_id}")
async def get_publish_job(
    job_id: str,
    db: AsyncSession = Depends(_get_db),
):
    """获取发布任务详情（含关联的交付包和变体）"""
    try:
        svc = PublishJobService(db)
        data = await svc.get_with_relations(job_id)
        if not data:
            raise HTTPException(status_code=404, detail="PublishJob not found")

        job = data["job"]
        return {
            "id": job.id,
            "project_id": job.project_id,
            "episode_id": job.episode_id,
            "platform": job.platform,
            "status": job.status,
            "scheduled_at": job.scheduled_at.isoformat() if job.scheduled_at else None,
            "payload_json": job.payload_json,
            "external_post_id": job.external_post_id,
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "published_at": job.published_at.isoformat() if job.published_at else None,
            "delivery_packages": [
                {
                    "id": p.id,
                    "package_no": p.package_no,
                    "status": p.status,
                    "asset_count": p.asset_count,
                    "total_size": p.total_size,
                }
                for p in data["delivery_packages"]
            ],
            "publish_variants": [
                {
                    "id": v.id,
                    "platform": v.platform,
                    "resolution": v.resolution,
                    "aspect_ratio": v.aspect_ratio,
                    "is_selected": v.is_selected,
                    "delivery_package_id": v.delivery_package_id,
                }
                for v in data["publish_variants"]
            ],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/jobs/{job_id}/transition", response_model=PublishJobRead)
async def transition_publish_job(
    job_id: str,
    req: TransitionRequest,
    db: AsyncSession = Depends(_get_db),
):
    """发布任务状态流转

    合法流转：
    - pending → running / failed / cancelled
    - running → success / failed / cancelled
    - failed → pending（重试）
    """
    try:
        svc = PublishJobService(db)
        job = await svc.transition(
            job_id=job_id,
            target_status=req.target_status,
            error_message=req.error_message,
        )
        await db.commit()
        return job
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
