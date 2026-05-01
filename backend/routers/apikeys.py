"""API Key CRUD 路由 — 完整实现"""
import logging


import hashlib
import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from database.models import ApiKey, User
from services.auth import get_current_user
from schemas.apikey import ApiKeyCreate, ApiKeyCreated, ApiKeyRead, ApiKeyUpdate


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/apikeys", tags=["apikeys"])


def _generate_key() -> tuple[str, str, str]:
    """生成密钥，返回 (明文, 哈希, 前缀)"""
    raw = f"mj_{secrets.token_urlsafe(32)}"
    key_hash = hashlib.sha256(raw.encode()).hexdigest()
    key_prefix = raw[:8]
    return raw, key_hash, key_prefix


@router.post("", response_model=ApiKeyCreated, status_code=201)
async def create_apikey(body: ApiKeyCreate, db: AsyncSession = Depends(get_db)):
    """创建 API Key（密钥仅此一次返回）"""
    raw, key_hash, key_prefix = _generate_key()
    apikey = ApiKey(
        name=body.name,
        key_hash=key_hash,
        key_prefix=key_prefix,
        provider=body.provider,
    )
    db.add(apikey)
    await db.flush()
    await db.refresh(apikey)
    return ApiKeyCreated(
        id=apikey.id,
        name=apikey.name,
        key=raw,
        key_prefix=key_prefix,
        provider=apikey.provider,
        created_at=apikey.created_at,
    )


@router.get("", response_model=list[ApiKeyRead])
async def list_apikeys(db: AsyncSession = Depends(get_db)):
    """获取 API Key 列表（不返回密钥明文）
    # 分页豁免：列表固定小
    """
    result = await db.execute(select(ApiKey).order_by(ApiKey.created_at.desc()))
    return result.scalars().all()


@router.get("/{apikey_id}", response_model=ApiKeyRead)
async def get_apikey(apikey_id: str, db: AsyncSession = Depends(get_db)):
    """获取单个 API Key"""
    apikey = await db.get(ApiKey, apikey_id)
    if not apikey:
        raise HTTPException(status_code=404, detail="API Key 不存在")
    return apikey


@router.patch("/{apikey_id}", response_model=ApiKeyRead)
async def update_apikey(apikey_id: str, body: ApiKeyUpdate, db: AsyncSession = Depends(get_db)):
    """更新 API Key"""
    apikey = await db.get(ApiKey, apikey_id)
    if not apikey:
        raise HTTPException(status_code=404, detail="API Key 不存在")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(apikey, key, value)
    await db.flush()
    await db.refresh(apikey)
    return apikey


@router.delete("/{apikey_id}", status_code=204)
async def delete_apikey(apikey_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """删除 API Key"""
    apikey = await db.get(ApiKey, apikey_id)
    if not apikey:
        raise HTTPException(status_code=404, detail="API Key 不存在")
    await db.delete(apikey)
    await db.flush()
