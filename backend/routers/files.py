"""文件上传与资产关联路由 — MinIO/S3 兼容"""

import os
import tempfile
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_db
from database.models import Asset, AssetLink
from schemas.asset import AssetCreate, AssetRead, AssetLinkCreate, AssetLinkRead, UploadResponse
from services.storage import get_storage_client

router = APIRouter(prefix="/api/files", tags=["files"])


@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(..., description="要上传的文件"),
    project_id: Optional[str] = Form(None, description="项目 ID（可选）"),
    asset_type: str = Form(..., description="资产类型（image/video/audio/document 等）"),
    owner_type: Optional[str] = Form(None, description="归属类型（scene/scene_version/qa_run/episode/publish_job）"),
    owner_id: Optional[str] = Form(None, description="归属对象 ID"),
    relation_type: Optional[str] = Form(None, description="关联类型"),
    db: AsyncSession = Depends(get_db),
):
    """
    上传文件并创建资产记录

    支持的文件类型：图片、视频、音频、文档等
    自动计算文件大小和 SHA256 校验和
    可选：立即创建 AssetLink 关联
    """
    # 验证文件
    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名不能为空")

    # 保存到临时文件
    temp_dir = tempfile.gettempdir()
    temp_path = os.path.join(temp_dir, f"manju_upload_{file.filename}")

    try:
        # 写入临时文件
        with open(temp_path, "wb") as f:
            content = await file.read()
            f.write(content)

        file_size = len(content)

        # 上传到 MinIO/S3
        storage = get_storage_client()
        object_name, public_url, _ = await storage.upload_file(
            file_path=temp_path,
            content_type=file.content_type,
            metadata={"original_filename": file.filename},
            prefix=asset_type,
        )

        # 创建资产记录
        asset = Asset(
            project_id=project_id,
            type=asset_type,
            uri=public_url,
            mime_type=file.content_type,
            file_size=file_size,
            metadata_json={"object_name": object_name, "original_filename": file.filename},
        )
        db.add(asset)
        await db.flush()
        await db.refresh(asset)

        # 如果指定了归属，创建 AssetLink
        if owner_type and owner_id:
            link = AssetLink(
                asset_id=asset.id,
                owner_type=owner_type,
                owner_id=owner_id,
                relation_type=relation_type,
            )
            db.add(link)
            await db.flush()

        await db.commit()

        return UploadResponse(
            asset_id=asset.id,
            uri=public_url,
            file_size=file_size,
            mime_type=file.content_type or "application/octet-stream",
            message="文件上传成功",
        )

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")
    finally:
        # 清理临时文件
        if os.path.exists(temp_path):
            os.remove(temp_path)


@router.get("/preview/{asset_id}")
async def preview_asset(asset_id: str, db: AsyncSession = Depends(get_db)):
    """
    获取资产的预签名 URL（临时访问）

    适用于需要临时访问的场景，避免暴露永久 URL
    """
    asset = await db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="资产不存在")

    # 只要 metadata 里有 object_name，优先走预签名 URL。
    # 现有库里很多 asset.uri 是 MinIO 对外地址，但直接访问会 403，
    # 因此不能仅凭 uri 是否是 http(s) 就当成可公开访问。
    try:
        storage = get_storage_client()
        object_name = asset.metadata_json.get("object_name") if asset.metadata_json else None
        if object_name:
            presigned_url = await storage.get_presigned_url(object_name, expires=3600)
            return {"data": {"url": presigned_url, "is_presigned": True, "expires_in": 3600}}

        if asset.uri:
            return {"data": {"url": asset.uri, "is_presigned": False}}

        raise HTTPException(status_code=400, detail="资产无法生成预览链接（缺少 object_name 和 uri）")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成预签名 URL 失败: {str(e)}")


@router.post("/assets/{asset_id}/link", response_model=AssetLinkRead, status_code=status.HTTP_201_CREATED)
async def link_asset(
    asset_id: str,
    body: AssetLinkCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    将资产关联到对象（场景、版本、QA 等）

    支持重复关联（一个资产可以属于多个对象）
    """
    # 验证资产存在
    asset = await db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="资产不存在")

    # 覆盖 asset_id（使用路径参数）
    link_data = body.model_dump()
    link_data["asset_id"] = asset_id

    # 创建关联
    link = AssetLink(**link_data)
    db.add(link)
    await db.flush()
    await db.refresh(link)
    await db.commit()

    return link


@router.get("/assets/{asset_id}/links", response_model=list[AssetLinkRead])
async def list_asset_links(asset_id: str, db: AsyncSession = Depends(get_db)):
    """获取资产的所有关联"""
    asset = await db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="资产不存在")

    q = select(AssetLink).where(AssetLink.asset_id == asset_id)
    result = await db.execute(q)
    links = result.scalars().all()
    return links


@router.post("/batch-upload", status_code=status.HTTP_201_CREATED)
async def batch_upload_files(
    files: list[UploadFile] = File(..., description="要上传的多个文件"),
    project_id: Optional[str] = Form(None, description="项目 ID（可选）"),
    asset_type: str = Form(..., description="资产类型"),
    db: AsyncSession = Depends(get_db),
):
    """
    批量上传文件

    返回上传结果列表（包含成功和失败的）
    """
    results = []
    assets_to_add = []

    for file in files:
        temp_path = None
        try:
            temp_dir = tempfile.gettempdir()
            temp_path = os.path.join(temp_dir, f"manju_batch_{file.filename}")

            with open(temp_path, "wb") as f:
                content = await file.read()
                f.write(content)

            file_size = len(content)

            storage = get_storage_client()
            object_name, public_url, _ = await storage.upload_file(
                file_path=temp_path,
                content_type=file.content_type,
                metadata={"original_filename": file.filename},
                prefix=asset_type,
            )

            # 收集待入库数据，循环内不写库
            assets_to_add.append({
                "project_id": project_id,
                "type": asset_type,
                "uri": public_url,
                "mime_type": file.content_type,
                "file_size": file_size,
                "metadata_json": {"object_name": object_name, "original_filename": file.filename},
                "filename": file.filename,
            })

            results.append({
                "filename": file.filename,
                "success": True,
                "uri": public_url,
            })

        except Exception as e:
            results.append({
                "filename": file.filename,
                "success": False,
                "error": str(e),
            })
        finally:
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)

    # 统一创建 Asset 记录（只 commit 一次）
    if assets_to_add:
        created_assets = []
        for data in assets_to_add:
            asset = Asset(
                project_id=data["project_id"],
                type=data["type"],
                uri=data["uri"],
                mime_type=data["mime_type"],
                file_size=data["file_size"],
                metadata_json=data["metadata_json"],
            )
            db.add(asset)
            created_assets.append(asset)

        await db.flush()

        # 回填 asset_id
        for asset, data in zip(created_assets, assets_to_add):
            for r in results:
                if r["filename"] == data["filename"] and r["success"]:
                    r["asset_id"] = asset.id

        await db.commit()

    return {"data": {"results": results, "total": len(files), "success_count": sum(1 for r in results if r["success"])}}
