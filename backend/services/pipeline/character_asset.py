"""Character Generation — 资产创建与 Prompt 构建

从 character.py 拆分：资产记录创建、prompt 构建
"""

import hashlib

from database.models import Asset, AssetLink, Character, CharacterAsset, SceneVersion
from sqlalchemy.ext.asyncio import AsyncSession

from services.storage.service import get_storage_service


def build_character_prompt(character: Character) -> str:
    """构建角色生成 prompt"""
    description = character.description or ""
    prompt = f"A character design of {character.name}. "
    if description:
        prompt += description
    prompt += ", high quality, detailed, professional character design"
    return prompt


async def create_character_asset(
    db: AsyncSession,
    character: Character,
    scene_version: SceneVersion,
    image_data: bytes,
    image_filename: str,
    similarity: float,
    ip_weight: float,
) -> Asset:
    """创建角色资产记录"""
    storage_filename = f"character_{character.id[:8]}_{image_filename}"
    storage_svc = get_storage_service()
    save_result = await storage_svc.save_bytes(
        image_data, storage_filename,
        mime_type="image/png", prefix="characters",
    )

    asset = Asset(
        id=hashlib.sha256(storage_filename.encode()).hexdigest()[:32],
        project_id=character.project_id,
        type="character_ref",
        uri=save_result["uri"],
        mime_type="image/png",
        file_size=save_result["size"],
        metadata_json={
            "provider": "comfyui",
            "character_id": character.id,
            "filename": image_filename,
            "similarity": similarity,
            "ip_weight": ip_weight,
            "status": "generated",
            "checksum": save_result["checksum"],
        },
    )
    db.add(asset)
    await db.flush()

    link = AssetLink(
        id=hashlib.sha256(f"{asset.id}_{scene_version.id}".encode()).hexdigest()[:32],
        asset_id=asset.id, owner_type="scene_version",
        owner_id=scene_version.id, relation_type="character_reference",
    )
    db.add(link)

    char_asset = CharacterAsset(
        id=hashlib.sha256(f"{character.id}_{asset.id}".encode()).hexdigest()[:32],
        character_id=character.id,
        asset_type="reference",
        asset_id=asset.id,
        uri=asset.uri,
        metadata_json={
            "similarity": similarity,
            "ip_weight": ip_weight,
            "scene_version_id": scene_version.id,
        },
    )
    db.add(char_asset)

    await db.flush()
    return asset


async def create_review_asset(
    db: AsyncSession,
    character: Character,
    scene_version: SceneVersion,
    similarity: float,
    ip_weight: float,
) -> Asset:
    """创建 needs_review 占位资产（所有重试都未通过阈值时）"""
    storage_svc = get_storage_service()
    save_result = await storage_svc.save_bytes(
        b"", f"{character.id}_review.png",
        mime_type="image/png", prefix="characters",
    )

    asset = Asset(
        id=hashlib.sha256(f"char_{character.id}_review".encode()).hexdigest()[:32],
        project_id=character.project_id,
        type="character_ref",
        uri=save_result["uri"],
        mime_type="image/png",
        file_size=save_result["size"],
        metadata_json={
            "provider": "comfyui",
            "character_id": character.id,
            "similarity": similarity,
            "ip_weight": ip_weight,
            "status": "needs_review",
            "reason": "IP-Adapter consistency check failed",
        },
    )
    db.add(asset)
    await db.flush()

    link = AssetLink(
        id=hashlib.sha256(f"{asset.id}_{scene_version.id}".encode()).hexdigest()[:32],
        asset_id=asset.id, owner_type="scene_version",
        owner_id=scene_version.id, relation_type="character_reference",
    )
    db.add(link)

    char_asset = CharacterAsset(
        id=hashlib.sha256(f"{character.id}_{asset.id}".encode()).hexdigest()[:32],
        character_id=character.id,
        asset_type="reference",
        asset_id=asset.id,
        uri=asset.uri,
        metadata_json={
            "similarity": similarity,
            "ip_weight": ip_weight,
            "status": "needs_review",
        },
    )
    db.add(char_asset)

    await db.flush()
    return asset
