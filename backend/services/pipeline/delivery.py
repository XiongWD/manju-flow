"""Delivery Package Builder — 041b1

最小闭环：从 episode 的已锁定 scene_versions 收集资产，
生成 delivery_package 记录，建立 asset_links 关联。
"""

from __future__ import annotations

import hashlib
import logging
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database.models import (
    Asset,
    AssetLink,
    DeliveryPackage,
    Episode,
    Scene,
    SceneVersion,
    PublishVariant,
)

logger = logging.getLogger(__name__)


class DeliveryPackageBuilder:
    """交付包构建器 — 从 episode 已锁定版本收集可交付资产"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def build(
        self,
        episode_id: str,
        publish_job_id: Optional[str] = None,
    ) -> DeliveryPackage:
        """构建一个交付包

        流程：
        1. 查询 episode 下所有 scene → locked_version_id
        2. 收集每个 locked version 的输出资产（via asset_links）
        3. 创建 DeliveryPackage 记录
        4. 创建 asset_links（owner_type=delivery_package）

        Args:
            episode_id: 剧集 ID
            publish_job_id: 可选关联的发布任务 ID

        Returns:
            DeliveryPackage: 创建的交付包
        """
        # 1. 查询 episode + scenes + locked versions
        stmt = (
            select(Episode)
            .options(selectinload(Episode.scenes).selectinload(Scene.versions))
            .where(Episode.id == episode_id)
        )
        result = await self.db.execute(stmt)
        episode = result.scalar_one_or_none()
        if not episode:
            raise ValueError(f"Episode not found: {episode_id}")

        # 2. 收集所有锁定版本的输出资产
        asset_ids: list[str] = []
        version_assets: dict[str, list[str]] = {}  # scene_id -> [asset_ids]

        for scene in episode.scenes:
            if not scene.locked_version_id:
                logger.debug("Scene %s has no locked version, skipping", scene.id)
                continue

            # 找到锁定版本
            locked_version = None
            for v in scene.versions:
                if v.id == scene.locked_version_id:
                    locked_version = v
                    break

            if not locked_version:
                logger.warning("Scene %s locked_version_id %s not found in versions",
                               scene.id, scene.locked_version_id)
                continue

            # 查该版本的输出资产
            link_stmt = (
                select(AssetLink)
                .where(
                    AssetLink.owner_type == "scene_version",
                    AssetLink.owner_id == locked_version.id,
                )
            )
            link_result = await self.db.execute(link_stmt)
            links = link_result.scalars().all()

            scene_asset_ids = []
            for link in links:
                asset_ids.append(link.asset_id)
                scene_asset_ids.append(link.asset_id)

            if scene_asset_ids:
                version_assets[scene.id] = scene_asset_ids

        # 3. 计算包序号
        count_stmt = (
            select(func.count())
            .select_from(DeliveryPackage)
            .where(DeliveryPackage.episode_id == episode_id)
        )
        count_result = await self.db.execute(count_stmt)
        next_no = (count_result.scalar() or 0) + 1

        # 4. 查资产文件大小
        total_size = 0
        if asset_ids:
            size_stmt = (
                select(func.coalesce(func.sum(Asset.file_size), 0))
                .where(Asset.id.in_(asset_ids))
            )
            size_result = await self.db.execute(size_stmt)
            total_size = size_result.scalar() or 0

        # 5. 创建 DeliveryPackage
        pkg = DeliveryPackage(
            project_id=episode.project_id,
            episode_id=episode_id,
            publish_job_id=publish_job_id,
            package_no=next_no,
            status="READY",
            total_size=total_size,
            asset_count=len(asset_ids),
            manifest_json={
                "scene_asset_map": version_assets,
                "total_assets": len(asset_ids),
            },
        )
        self.db.add(pkg)
        await self.db.flush()

        # 6. 创建 asset_links（owner_type=delivery_package）
        for asset_id in asset_ids:
            link = AssetLink(
                asset_id=asset_id,
                owner_type="delivery_package",
                owner_id=pkg.id,
                relation_type="bundle",
            )
            self.db.add(link)

        await self.db.flush()
        logger.info(
            "Delivery package %s created: episode=%s, assets=%d, size=%d",
            pkg.id, episode_id, len(asset_ids), total_size,
        )
        return pkg

    async def create_variant(
        self,
        delivery_package_id: str,
        platform: str,
        resolution: Optional[str] = None,
        aspect_ratio: Optional[str] = None,
        bitrate: Optional[str] = None,
    ) -> PublishVariant:
        """为交付包创建平台变体记录

        Args:
            delivery_package_id: 交付包 ID
            platform: 目标平台
            resolution: 分辨率
            aspect_ratio: 画面比例
            bitrate: 码率

        Returns:
            PublishVariant: 创建的变体记录
        """
        pkg_stmt = select(DeliveryPackage).where(
            DeliveryPackage.id == delivery_package_id
        )
        result = await self.db.execute(pkg_stmt)
        pkg = result.scalar_one_or_none()
        if not pkg:
            raise ValueError(f"DeliveryPackage not found: {delivery_package_id}")

        # 用交付包的 publish_job_id 关联，没有则 variant 独立存在
        variant = PublishVariant(
            publish_job_id=pkg.publish_job_id or "standalone",
            platform=platform,
            delivery_package_id=delivery_package_id,
            resolution=resolution,
            aspect_ratio=aspect_ratio,
            bitrate=bitrate,
            metadata_json={
                "delivery_package_id": delivery_package_id,
                "source_asset_count": pkg.asset_count,
            },
        )
        self.db.add(variant)
        await self.db.flush()

        logger.info(
            "Platform variant %s created: platform=%s, pkg=%s",
            variant.id, platform, delivery_package_id,
        )
        return variant
