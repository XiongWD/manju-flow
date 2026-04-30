"""镜头复杂度评分服务

基于镜头属性自动计算生成难度评分（0.0-10.0）。
评分维度：
- 时长分：镜头越长越复杂
- 角色分：角色越多越复杂
- 地点分：有地点描述比无地点更复杂
- 动作分：从 prompt_bundle 中检测动作描述
- 风格分：从 prompt_bundle 中检测风格关键词
"""

import json
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database.models import ComplexityProfile, Scene, SceneVersion


# ── 关键词表 ──────────────────────────────────────────────────────────────

ACTION_KEYWORDS_EN = [
    "run", "walk", "fight", "dance", "jump", "fly", "swim", "fall",
    "throw", "catch", "chase", "escape", "transform", "explode",
    "crash", "burn", "freeze", "melt",
]

ACTION_KEYWORDS_ZH = [
    "跑", "走", "打", "跳", "飞", "游", "追", "逃", "变", "爆", "烧", "冻", "融",
]

STYLE_KEYWORDS_EN = [
    "cinematic", "photorealistic", "anime", "watercolor", "oil painting",
    "cyberpunk", "fantasy", "horror", "noir", "vintage", "3d render",
]

STYLE_KEYWORDS_ZH = [
    "电影感", "写实", "动漫", "水彩", "油画", "赛博朋克", "奇幻", "恐怖", "黑白",
]


class ComplexityService:
    """镜头复杂度评分服务"""

    # ── 公开接口 ──────────────────────────────────────────────────────────

    async def calculate(self, db: AsyncSession, scene_id: str) -> ComplexityProfile:
        """计算或更新镜头复杂度"""
        scene = await self._load_scene(db, scene_id)
        breakdown = self._compute_breakdown(scene)
        overall = (
            breakdown["duration_score"]
            + breakdown["character_score"]
            + breakdown["location_score"]
            + breakdown["action_score"]
            + breakdown["style_score"]
        )

        # 查找已有 profile（upsert）
        result = await db.execute(
            select(ComplexityProfile).where(ComplexityProfile.scene_id == scene_id)
        )
        profile = result.scalar_one_or_none()

        if profile is not None:
            profile.overall_score = overall
            profile.character_count = breakdown["character_count"]
            profile.has_location = breakdown["has_location"]
            profile.duration_score = breakdown["duration_score"]
            profile.character_score = breakdown["character_score"]
            profile.action_score = breakdown["action_score"]
            profile.style_score = breakdown["style_score"]
            profile.breakdown = json.dumps(breakdown, ensure_ascii=False)
        else:
            profile = ComplexityProfile(
                scene_id=scene_id,
                overall_score=overall,
                character_count=breakdown["character_count"],
                has_location=breakdown["has_location"],
                duration_score=breakdown["duration_score"],
                character_score=breakdown["character_score"],
                action_score=breakdown["action_score"],
                style_score=breakdown["style_score"],
                breakdown=json.dumps(breakdown, ensure_ascii=False),
            )
            db.add(profile)

        await db.commit()
        await db.refresh(profile)
        return profile

    async def get_or_calculate(
        self, db: AsyncSession, scene_id: str
    ) -> ComplexityProfile:
        """获取已有评分，不存在则自动计算"""
        result = await db.execute(
            select(ComplexityProfile).where(ComplexityProfile.scene_id == scene_id)
        )
        profile = result.scalar_one_or_none()
        if profile is not None:
            return profile
        return await self.calculate(db, scene_id)

    async def get_episode_summary(
        self, db: AsyncSession, episode_id: str
    ) -> list[ComplexityProfile]:
        """获取剧集下所有镜头的复杂度 profile"""
        result = await db.execute(
            select(ComplexityProfile)
            .join(Scene, ComplexityProfile.scene_id == Scene.id)
            .where(Scene.episode_id == episode_id)
            .order_by(Scene.scene_no)
        )
        return list(result.scalars().all())

    # ── 私有方法 ──────────────────────────────────────────────────────────

    async def _load_scene(self, db: AsyncSession, scene_id: str) -> Scene:
        result = await db.execute(
            select(Scene)
            .options(
                selectinload(Scene.characters),
                selectinload(Scene.location),
                selectinload(Scene.versions),
            )
            .where(Scene.id == scene_id)
        )
        scene = result.scalar_one_or_none()
        if scene is None:
            raise ValueError(f"Scene {scene_id} not found")
        return scene

    def _compute_breakdown(self, scene: Scene) -> dict:
        """计算各维度评分明细"""
        # 时长分 (0-2.0)
        dur = scene.duration or 0
        if dur <= 3:
            duration_score = 0.5
            duration_detail = f"时长 {dur}s ≤ 3s，低复杂度"
        elif dur <= 5:
            duration_score = 1.0
            duration_detail = f"时长 {dur}s ≤ 5s，中低复杂度"
        elif dur <= 10:
            duration_score = 1.5
            duration_detail = f"时长 {dur}s ≤ 10s，中高复杂度"
        else:
            duration_score = 2.0
            duration_detail = f"时长 {dur}s > 10s，高复杂度"

        # 角色分 (0-2.5)
        char_count = len(scene.characters) if scene.characters else 0
        char_score_map = {0: 0, 1: 0.5, 2: 1.0, 3: 1.5, 4: 2.0}
        character_score = char_score_map.get(min(char_count, 4), 2.5)
        character_detail = f"角色数量 {char_count}，得分 {character_score}"

        # 地点分 (0-1.0)
        loc = scene.location
        has_loc = loc is not None
        if not has_loc:
            location_score = 0.0
            location_detail = "无地点信息"
        elif loc.description and len(loc.description.strip()) > 20:
            location_score = 1.0
            location_detail = f"有地点且详细描述（{loc.name}）"
        else:
            location_score = 0.5
            location_detail = f"有地点但描述简略（{loc.name}）" if loc else "有地点引用"

        # 动作分 & 风格分：从 prompt_bundle 中提取
        prompt_text = self._extract_positive_prompt(scene)

        action_found = self._match_keywords(
            prompt_text, ACTION_KEYWORDS_EN + ACTION_KEYWORDS_ZH
        )
        action_score = min(len(action_found) * 0.3, 2.5)
        action_detail = (
            f"检测到 {len(action_found)} 个动作关键词，得分 {action_score}"
            if action_found
            else "未检测到动作关键词"
        )

        style_found = self._match_keywords(
            prompt_text, STYLE_KEYWORDS_EN + STYLE_KEYWORDS_ZH
        )
        style_score = min(len(style_found) * 0.4, 2.0)
        style_detail = (
            f"检测到 {len(style_found)} 个风格关键词，得分 {style_score}"
            if style_found
            else "未检测到风格关键词"
        )

        return {
            "duration_score": duration_score,
            "duration_detail": duration_detail,
            "character_score": character_score,
            "character_count": char_count,
            "character_detail": character_detail,
            "location_score": location_score,
            "location_detail": location_detail,
            "has_location": has_loc,
            "action_score": action_score,
            "action_keywords_found": action_found,
            "action_detail": action_detail,
            "style_score": style_score,
            "style_keywords_found": style_found,
            "style_detail": style_detail,
        }

    @staticmethod
    def _extract_positive_prompt(scene: Scene) -> str:
        """从镜头最新版本的 prompt_bundle 中提取 positive prompt 文本"""
        if not scene.versions:
            return ""
        # 取最新版本
        latest = sorted(scene.versions, key=lambda v: v.version_no, reverse=True)[0]
        bundle = latest.prompt_bundle
        if not bundle:
            return ""
        # 支持 dict 直接取 positive，也支持嵌套
        if isinstance(bundle, dict):
            return str(bundle.get("positive", "") or bundle.get("prompt", "") or "")
        return ""

    @staticmethod
    def _match_keywords(text: str, keywords: list[str]) -> list[str]:
        """在文本中匹配关键词（忽略大小写）"""
        if not text:
            return []
        text_lower = text.lower()
        found = []
        for kw in keywords:
            if kw.lower() in text_lower:
                found.append(kw)
        return found
