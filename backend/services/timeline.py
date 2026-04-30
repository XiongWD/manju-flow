"""Timeline 导出服务 — 将剧集镜头按序号排列并导出为结构化格式"""

import csv
import io
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database.models import (
    Asset,
    AssetLink,
    Character,
    Episode,
    Location,
    Scene,
    SceneVersion,
)


class TimelineService:
    """Timeline 导出服务

    将剧集的镜头按序号排列，导出为结构化格式。
    """

    async def export_json(
        self,
        db: AsyncSession,
        episode_id: str,
        include_prompts: bool = False,
        include_assets: bool = False,
    ) -> dict:
        """导出为 JSON 格式

        Returns:
            {
                "episode_id": str,
                "episode_title": str,
                "exported_at": str (ISO),
                "total_duration": float,
                "scene_count": int,
                "scenes": [...]
            }
        """
        # 获取 episode
        episode = await db.get(Episode, episode_id)
        if not episode:
            raise ValueError(f"Episode {episode_id} not found")

        # 获取所有 scene，预加载 location / characters
        stmt = (
            select(Scene)
            .where(Scene.episode_id == episode_id)
            .options(
                selectinload(Scene.location),
                selectinload(Scene.characters),
            )
            .order_by(Scene.scene_no.asc())
        )
        result = await db.execute(stmt)
        scenes: list[Scene] = list(result.scalars().all())

        scene_list: list[dict] = []
        total_duration = 0.0

        for scene in scenes:
            total_duration += scene.duration or 0.0

            item: dict = {
                "scene_no": scene.scene_no,
                "title": scene.title or "",
                "duration": scene.duration,
                "shot_stage": scene.shot_stage,
                "location": (
                    {
                        "name": scene.location.name,
                        "description": scene.location.description or "",
                    }
                    if scene.location
                    else None
                ),
                "characters": [
                    {"name": c.name, "role": c.role_type or ""}
                    for c in scene.characters
                ],
                "locked_still_id": scene.locked_still_id,
            }

            # 可选：获取最新锁定版本的 prompt_bundle
            if include_prompts:
                version_id = scene.locked_version_id
                if not version_id and scene.versions:
                    # 取最新版本
                    version_id = max(scene.versions, key=lambda v: v.version_no).id
                prompt_bundle = None
                if version_id:
                    version = await db.get(SceneVersion, version_id)
                    if version:
                        prompt_bundle = version.prompt_bundle
                item["prompt_bundle"] = prompt_bundle

            # 可选：获取最新锁定版本的资产列表
            if include_assets:
                version_id = scene.locked_version_id
                if not version_id and scene.versions:
                    version_id = max(scene.versions, key=lambda v: v.version_no).id
                assets_list: list[dict] = []
                if version_id:
                    link_stmt = (
                        select(Asset)
                        .join(AssetLink, AssetLink.asset_id == Asset.id)
                        .where(
                            AssetLink.owner_type == "scene_version",
                            AssetLink.owner_id == version_id,
                        )
                    )
                    link_result = await db.execute(link_stmt)
                    for asset in link_result.scalars().all():
                        assets_list.append({
                            "id": asset.id,
                            "type": asset.type,
                            "uri": asset.uri,
                            "mime_type": asset.mime_type,
                        })
                item["assets"] = assets_list

            scene_list.append(item)

        return {
            "episode_id": episode_id,
            "episode_title": episode.title or "",
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "total_duration": total_duration,
            "scene_count": len(scene_list),
            "scenes": scene_list,
        }

    async def export_csv(
        self,
        db: AsyncSession,
        episode_id: str,
    ) -> str:
        """导出为 CSV 格式

        列：序号, 标题, 时长(秒), 阶段, 地点, 角色, 锁定静帧
        返回 CSV 字符串
        """
        stmt = (
            select(Scene)
            .where(Scene.episode_id == episode_id)
            .options(
                selectinload(Scene.location),
                selectinload(Scene.characters),
            )
            .order_by(Scene.scene_no.asc())
        )
        result = await db.execute(stmt)
        scenes: list[Scene] = list(result.scalars().all())

        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["序号", "标题", "时长(秒)", "阶段", "地点", "角色", "锁定静帧"])

        for scene in scenes:
            location_name = scene.location.name if scene.location else ""
            character_names = "、".join(c.name for c in scene.characters)
            writer.writerow([
                scene.scene_no,
                scene.title or "",
                scene.duration or 0,
                scene.shot_stage,
                location_name,
                character_names,
                scene.locked_still_id or "",
            ])

        return buf.getvalue()
