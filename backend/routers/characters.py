"""Character CRUD 路由 — 含角色-剧集关联"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from database.models import Character, CharacterEpisode
from schemas.character import CharacterCreate, CharacterUpdate, CharacterRead

router = APIRouter(prefix="/api/characters", tags=["characters"])


async def _load_episode_ids(db: AsyncSession, character_id: str) -> list[str]:
    """加载角色的关联剧集 ID 列表"""
    result = await db.execute(
        select(CharacterEpisode.episode_id)
        .where(CharacterEpisode.character_id == character_id)
    )
    return [row[0] for row in result.all()]


async def _sync_episode_ids(
    db: AsyncSession,
    character_id: str,
    episode_ids: list[str] | None,
) -> None:
    """同步角色-剧集关联（全量替换）"""
    if episode_ids is None:
        return
    # 删除旧关联
    await db.execute(
        CharacterEpisode.__table__.delete()
        .where(CharacterEpisode.character_id == character_id)
    )
    # 插入新关联
    if episode_ids:
        await db.execute(
            CharacterEpisode.__table__.insert(),
            [{"character_id": character_id, "episode_id": eid} for eid in episode_ids],
        )


def _to_read(char: Character, episode_ids: list[str]) -> dict:
    """将 ORM 对象 + episode_ids 转为 CharacterRead 字典"""
    return {
        "id": char.id,
        "project_id": char.project_id,
        "name": char.name,
        "role_type": char.role_type,
        "description": char.description,
        "voice_profile": char.voice_profile,
        "canonical_asset_id": char.canonical_asset_id,
        "episode_ids": episode_ids,
        "created_at": char.created_at,
        "updated_at": char.updated_at,
    }


@router.post("/", response_model=CharacterRead, status_code=201)
async def create_character(body: CharacterCreate, db: AsyncSession = Depends(get_db)):
    """创建角色（可选关联剧集）"""
    episode_ids = body.episode_ids
    obj = Character(**body.model_dump(exclude={"episode_ids"}))
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    await _sync_episode_ids(db, obj.id, episode_ids)
    await db.flush()
    return _to_read(obj, await _load_episode_ids(db, obj.id))


@router.get("/", response_model=list[CharacterRead])
async def list_characters(project_id: str, db: AsyncSession = Depends(get_db)):
    """按项目获取角色列表"""
    result = await db.execute(
        select(Character)
        .where(Character.project_id == project_id)
        .order_by(Character.created_at.desc())
    )
    chars = result.scalars().all()
    out = []
    for c in chars:
        eids = await _load_episode_ids(db, c.id)
        out.append(CharacterRead(**_to_read(c, eids)))
    return out


@router.get("/by-episode/{episode_id}", response_model=list[CharacterRead])
async def list_characters_by_episode(episode_id: str, db: AsyncSession = Depends(get_db)):
    """按剧集获取关联角色列表"""
    result = await db.execute(
        select(Character)
        .join(CharacterEpisode, CharacterEpisode.character_id == Character.id)
        .where(CharacterEpisode.episode_id == episode_id)
        .order_by(Character.created_at.desc())
    )
    chars = result.scalars().all()
    out = []
    for c in chars:
        eids = await _load_episode_ids(db, c.id)
        out.append(CharacterRead(**_to_read(c, eids)))
    return out


@router.get("/{character_id}", response_model=CharacterRead)
async def get_character(character_id: str, db: AsyncSession = Depends(get_db)):
    """获取单个角色"""
    obj = await db.get(Character, character_id)
    if not obj:
        raise HTTPException(status_code=404, detail="角色不存在")
    eids = await _load_episode_ids(db, character_id)
    return CharacterRead(**_to_read(obj, eids))


@router.patch("/{character_id}", response_model=CharacterRead)
async def update_character(character_id: str, body: CharacterUpdate, db: AsyncSession = Depends(get_db)):
    """更新角色"""
    obj = await db.get(Character, character_id)
    if not obj:
        raise HTTPException(status_code=404, detail="角色不存在")
    episode_ids = body.episode_ids
    for key, value in body.model_dump(exclude={"episode_ids"}, exclude_unset=True).items():
        setattr(obj, key, value)
    await db.flush()
    await db.refresh(obj)
    await _sync_episode_ids(db, character_id, episode_ids)
    await db.flush()
    return _to_read(obj, await _load_episode_ids(db, character_id))


@router.delete("/{character_id}", status_code=204)
async def delete_character(character_id: str, db: AsyncSession = Depends(get_db)):
    """删除角色"""
    obj = await db.get(Character, character_id)
    if not obj:
        raise HTTPException(status_code=404, detail="角色不存在")
    # junction rows cascade via FK, but delete explicitly to be safe
    await db.execute(
        CharacterEpisode.__table__.delete()
        .where(CharacterEpisode.character_id == character_id)
    )
    await db.delete(obj)
    await db.flush()
