"""资产路由 — 完整 CRUD 实现"""
import logging


from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_db
from database.models import Asset, AssetLink
from schemas.asset import AssetCreate, AssetUpdate, AssetRead, AssetWithLinksRead, AssetLinkCreate, AssetLinkRead
from services.storage import get_storage_client


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/assets", tags=["assets"])


@router.get("/")
async def list_assets(
    project_id: str = Query(None, description="项目 ID"),
    owner_type: str = Query(None, description="归属类型"),
    owner_id: str = Query(None, description="归属对象 ID"),
    asset_type: str = Query(None, description="资产类型"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1),
    search: str = Query("", description="搜索关键词"),
    db: AsyncSession = Depends(get_db),
):
    """获取资产列表，支持按 owner_type + owner_id 过滤"""
    limit = min(limit, 200)
    q = select(Asset)
    if project_id:
        q = q.where(Asset.project_id == project_id)
    if asset_type:
        q = q.where(Asset.type == asset_type)
    if search:
        q = q.filter(or_(
            Asset.type.ilike(f"%{search}%"),
            Asset.uri.ilike(f"%{search}%"),
        ))

    # 如果指定了 owner，需要 join asset_links
    if owner_type and owner_id:
        q = (
            q.join(AssetLink, AssetLink.asset_id == Asset.id)
            .where(AssetLink.owner_type == owner_type, AssetLink.owner_id == owner_id)
        )

    # count
    total_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_result.scalar() or 0

    q = q.order_by(Asset.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    items = result.scalars().all()
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.post("/", response_model=AssetRead, status_code=status.HTTP_201_CREATED)
async def create_asset(body: AssetCreate, db: AsyncSession = Depends(get_db)):
    """创建资产记录（不上传文件，只创建记录）"""
    asset = Asset(**body.model_dump())
    db.add(asset)
    await db.flush()
    await db.refresh(asset)
    return asset


@router.get("/{asset_id}", response_model=AssetWithLinksRead)
async def get_asset(asset_id: str, db: AsyncSession = Depends(get_db)):
    """获取单个资产详情，含关联列表"""
    asset = await db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    # 获取关联的 links
    # 分页豁免：列表固定小
    links_q = select(AssetLink).where(AssetLink.asset_id == asset_id)
    links_result = await db.execute(links_q)
    links = links_result.scalars().all()

    return {
        "id": asset.id,
        "project_id": asset.project_id,
        "type": asset.type,
        "uri": asset.uri,
        "mime_type": asset.mime_type,
        "file_size": asset.file_size,
        "duration": asset.duration,
        "width": asset.width,
        "height": asset.height,
        "metadata_json": asset.metadata_json,
        "checksum": asset.checksum,
        "created_at": asset.created_at,
        "links": links,
    }


@router.patch("/{asset_id}", response_model=AssetRead)
async def update_asset(
    asset_id: str,
    body: AssetUpdate,
    db: AsyncSession = Depends(get_db)
):
    """更新资产"""
    asset = await db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(asset, key, value)
    await db.flush()
    await db.refresh(asset)
    return asset


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset(asset_id: str, db: AsyncSession = Depends(get_db)):
    """删除资产及其关联（同时删除 MinIO/S3 中的文件）"""
    asset = await db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    # 删除存储中的文件
    try:
        if asset.metadata_json:
            object_name = asset.metadata_json.get("object_name")
            if object_name:
                storage = get_storage_client()
                await storage.delete_file(object_name)
    except Exception:
        # 存储删除失败不影响数据库清理（允许 orphan objects）
        pass

    await db.delete(asset)
    await db.commit()


@router.post("/{asset_id}/links", response_model=AssetLinkRead, status_code=status.HTTP_201_CREATED)
async def create_asset_link(
    asset_id: str,
    body: AssetLinkCreate,
    db: AsyncSession = Depends(get_db)
):
    """将资产关联到对象"""
    # 验证资产存在
    asset = await db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    # 覆盖 asset_id
    link_data = body.model_dump()
    link_data["asset_id"] = asset_id

    link = AssetLink(**link_data)
    db.add(link)
    await db.flush()
    await db.refresh(link)
    return link


@router.get("/{asset_id}/links", response_model=list[AssetLinkRead])
async def list_asset_links(asset_id: str, db: AsyncSession = Depends(get_db)):
    """获取资产的所有关联"""
    asset = await db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    q = select(AssetLink).where(AssetLink.asset_id == asset_id)
    result = await db.execute(q)
    links = result.scalars().all()
    return links


@router.delete("/links/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset_link(link_id: str, db: AsyncSession = Depends(get_db)):
    """删除资产关联"""
    link = await db.get(AssetLink, link_id)
    if not link:
        raise HTTPException(status_code=404, detail="Asset link not found")
    await db.delete(link)
    await db.flush()
