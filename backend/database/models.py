"""Manju Production OS — 全部 ORM 模型

模型清单：
 0.  users (auth)
 1.  projects           2.  project_configs     3.  story_bibles
 4.  characters          5.  character_assets    6.  episodes
 7.  scenes              8.  scene_versions      9.  assets
10. asset_links         11. jobs               12. job_steps
13. qa_runs             14. qa_issues          15. publish_jobs
16. publish_variants    17. analytics_snapshots 18. knowledge_items
19. api_keys            20. delivery_packages   21. job_events
22. locations           23. script_parse_reports 24. shot_import_reports
25. script_issues       26. still_candidates
"""

from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SAEnum,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .connection import Base


def _uuid() -> str:
    return uuid4().hex


def _now() -> datetime:
    return datetime.utcnow()


# ─── 1. projects ────────────────────────────────────────────────────────────

class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(256), nullable=False, comment="项目名称")
    genre: Mapped[Optional[str]] = mapped_column(String(64), comment="题材（Revenge/Werewolf/Mafia/CEO）")
    market: Mapped[Optional[str]] = mapped_column(String(32), comment="目标市场（US/UK/SEA）")
    platform: Mapped[Optional[str]] = mapped_column(String(32), comment="目标平台（tiktok/douyin）")
    tier: Mapped[Optional[str]] = mapped_column(String(16), comment="质量等级（S/SSS/A/B）")
    budget_limit: Mapped[Optional[float]] = mapped_column(Float, comment="预算上限（USD）")
    status: Mapped[str] = mapped_column(String(32), default="DRAFT", comment="项目状态")
    description: Mapped[Optional[str]] = mapped_column(Text, comment="项目描述")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    # 关系
    configs: Mapped[list["ProjectConfig"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    story_bibles: Mapped[list["StoryBible"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    characters: Mapped[list["Character"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    episodes: Mapped[list["Episode"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    knowledge_items: Mapped[list["KnowledgeItem"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    locations: Mapped[list["Location"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    props: Mapped[list["Prop"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    prompt_templates: Mapped[list["PromptTemplate"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    cost_records: Mapped[list["CostRecord"]] = relationship(back_populates="project", cascade="all, delete-orphan")


# ─── 2. project_configs ─────────────────────────────────────────────────────

class ProjectConfig(Base):
    __tablename__ = "project_configs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    config_key: Mapped[str] = mapped_column(String(128), nullable=False, comment="配置键")
    config_value_json: Mapped[Optional[dict]] = mapped_column(JSON, comment="配置值（JSON）")
    version: Mapped[int] = mapped_column(Integer, default=1, comment="配置版本号")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    project: Mapped["Project"] = relationship(back_populates="configs")


# ─── 3. story_bibles ────────────────────────────────────────────────────────

class StoryBible(Base):
    __tablename__ = "story_bibles"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[Optional[str]] = mapped_column(String(256), comment="标题")
    summary: Mapped[Optional[str]] = mapped_column(Text, comment="一句话摘要")
    theme: Mapped[Optional[str]] = mapped_column(String(256), comment="核心主题")
    conflict: Mapped[Optional[str]] = mapped_column(Text, comment="核心冲突")
    content: Mapped[Optional[str]] = mapped_column(Text, comment="世界观/剧情设定内容")
    beat_sheet: Mapped[Optional[dict]] = mapped_column(JSON, comment="节拍表（JSON）")
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    project: Mapped["Project"] = relationship(back_populates="story_bibles")


# ─── 4. characters ──────────────────────────────────────────────────────────

class Character(Base):
    __tablename__ = "characters"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False, comment="角色名")
    role_type: Mapped[Optional[str]] = mapped_column(String(32), comment="主角/配角/反派/路人")
    description: Mapped[Optional[str]] = mapped_column(Text, comment="角色描述")
    voice_profile: Mapped[Optional[dict]] = mapped_column(JSON, comment="声音配置（provider/voice_id/params）")
    canonical_asset_id: Mapped[Optional[str]] = mapped_column(String(32), comment="代表资产 ID")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    project: Mapped["Project"] = relationship(back_populates="characters")
    assets: Mapped[list["CharacterAsset"]] = relationship(back_populates="character", cascade="all, delete-orphan")
    episodes: Mapped[list["Episode"]] = relationship(
        secondary="character_episodes", back_populates="characters"
    )
    scenes: Mapped[list["Scene"]] = relationship(
        secondary="scene_characters", back_populates="characters"
    )


# ─── 4b. character_episodes (junction) ─────────────────────────────────────

class CharacterEpisode(Base):
    __tablename__ = "character_episodes"

    character_id: Mapped[str] = mapped_column(
        ForeignKey("characters.id", ondelete="CASCADE"), primary_key=True
    )
    episode_id: Mapped[str] = mapped_column(
        ForeignKey("episodes.id", ondelete="CASCADE"), primary_key=True, index=True
    )


# ─── 5. character_assets ────────────────────────────────────────────────────

class CharacterAsset(Base):
    __tablename__ = "character_assets"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    character_id: Mapped[str] = mapped_column(ForeignKey("characters.id", ondelete="CASCADE"), nullable=False)
    asset_type: Mapped[str] = mapped_column(String(32), comment="front/side/expression/reference")
    asset_id: Mapped[Optional[str]] = mapped_column(String(32), comment="关联 assets.id")
    uri: Mapped[Optional[str]] = mapped_column(String(512), comment="文件路径或 URL")
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    character: Mapped["Character"] = relationship(back_populates="assets")


# ─── 6. episodes ────────────────────────────────────────────────────────────

class Episode(Base):
    __tablename__ = "episodes"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    episode_no: Mapped[int] = mapped_column(Integer, comment="集号")
    title: Mapped[Optional[str]] = mapped_column(String(256))
    outline: Mapped[Optional[str]] = mapped_column(Text, comment="剧本大纲")
    script: Mapped[Optional[str]] = mapped_column(Text, comment="完整剧本")
    duration: Mapped[Optional[float]] = mapped_column(Float, comment="时长（秒）")
    status: Mapped[str] = mapped_column(String(32), default="DRAFTING")
    current_cut_asset_id: Mapped[Optional[str]] = mapped_column(String(32), comment="当前剪辑版资产 ID")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    project: Mapped["Project"] = relationship(back_populates="episodes")
    scenes: Mapped[list["Scene"]] = relationship(back_populates="episode", cascade="all, delete-orphan")
    characters: Mapped[list["Character"]] = relationship(
        secondary="character_episodes", back_populates="episodes"
    )


# ─── 7. scenes ──────────────────────────────────────────────────────────────

class Scene(Base):
    __tablename__ = "scenes"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    episode_id: Mapped[str] = mapped_column(ForeignKey("episodes.id", ondelete="CASCADE"), nullable=False, index=True)
    scene_no: Mapped[int] = mapped_column(Integer, comment="镜头序号")
    title: Mapped[Optional[str]] = mapped_column(String(256))
    duration: Mapped[Optional[float]] = mapped_column(Float, comment="时长（秒）")
    status: Mapped[str] = mapped_column(String(32), default="DRAFT")
    locked_version_id: Mapped[Optional[str]] = mapped_column(String(32), comment="锁定版本 ID")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    episode: Mapped["Episode"] = relationship(back_populates="scenes")
    versions: Mapped[list["SceneVersion"]] = relationship(back_populates="scene", cascade="all, delete-orphan")
    characters: Mapped[list["Character"]] = relationship(
        secondary="scene_characters", back_populates="scenes"
    )
    location_id: Mapped[Optional[str]] = mapped_column(ForeignKey("locations.id", ondelete="SET NULL"), index=True, comment="关联地点 ID")
    shot_stage: Mapped[str] = mapped_column(String(32), default="draft", comment="镜头生产阶段：draft/script_parsed/still_generating/still_review/still_locked/video_generating/video_review/video_locked/compose_ready/delivery")
    location: Mapped[Optional["Location"]] = relationship()
    locked_still_id: Mapped[Optional[str]] = mapped_column(String(32), index=True, comment="锁定的静帧候选 ID")
    still_candidates: Mapped[list["StillCandidate"]] = relationship(back_populates="scene", cascade="all, delete-orphan")


# ─── 7b. scene_characters (junction) ─────────────────────────────

class SceneCharacter(Base):
    __tablename__ = "scene_characters"

    scene_id: Mapped[str] = mapped_column(
        ForeignKey("scenes.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    character_id: Mapped[str] = mapped_column(
        ForeignKey("characters.id", ondelete="CASCADE"), primary_key=True
    )


# ─── 8. scene_versions ─────────────────────────────────────────────────────
# ⚠️ 红线模型：必须真实存在，版本化核心

class SceneVersion(Base):
    __tablename__ = "scene_versions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    scene_id: Mapped[str] = mapped_column(ForeignKey("scenes.id", ondelete="CASCADE"), nullable=False)
    parent_version_id: Mapped[Optional[str]] = mapped_column(String(32), comment="父版本 ID（用于版本链追踪）")
    version_no: Mapped[int] = mapped_column(Integer, nullable=False, comment="版本号")
    prompt_bundle: Mapped[Optional[dict]] = mapped_column(JSON, comment="Prompt 包（正面/负面/风格/参数）")
    model_bundle: Mapped[Optional[dict]] = mapped_column(JSON, comment="模型包（生图/视频/音频模型配置）")
    params: Mapped[Optional[dict]] = mapped_column(JSON, comment="其他参数（分辨率/帧率/种子等）")
    change_reason: Mapped[Optional[str]] = mapped_column(String(512), comment="变更原因")
    status: Mapped[str] = mapped_column(String(32), default="GENERATING",
                                         comment="GENERATING/QA_PASSED/NEEDS_REVIEW/MANUAL_APPROVED/LOCKED/DELIVERED")
    score_snapshot: Mapped[Optional[dict]] = mapped_column(JSON, comment="QA 分数快照")
    cost_actual: Mapped[Optional[float]] = mapped_column(Float, comment="实际成本（USD）")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    scene: Mapped["Scene"] = relationship(back_populates="versions")


# ─── 9. assets ──────────────────────────────────────────────────────────────

class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    project_id: Mapped[Optional[str]] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"), index=True)
    type: Mapped[str] = mapped_column(String(64), nullable=False, comment="资产类型")
    uri: Mapped[Optional[str]] = mapped_column(String(512), comment="文件路径或 URL")
    mime_type: Mapped[Optional[str]] = mapped_column(String(64))
    file_size: Mapped[Optional[int]] = mapped_column(Integer, comment="文件大小（bytes）")
    duration: Mapped[Optional[float]] = mapped_column(Float, comment="时长（秒，音视频用）")
    width: Mapped[Optional[int]] = mapped_column(Integer)
    height: Mapped[Optional[int]] = mapped_column(Integer)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSON)
    checksum: Mapped[Optional[str]] = mapped_column(String(64), comment="SHA256")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    # asset type 枚举值：character_ref, scene_bg, image, video, audio,
    #   mixed_audio, subtitle, cover, rules_report, c2pa_manifest,
    #   watermark_proof, qa_evidence, detection_json,
    #   delivery_bundle, platform_variant

    links: Mapped[list["AssetLink"]] = relationship(back_populates="asset", cascade="all, delete-orphan")


# ─── 10. asset_links ────────────────────────────────────────────────────────

class AssetLink(Base):
    __tablename__ = "asset_links"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    asset_id: Mapped[str] = mapped_column(ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_type: Mapped[str] = mapped_column(String(32), nullable=False,
                                             comment="scene/scene_version/qa_run/episode/publish_job")
    owner_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True, comment="归属对象 ID")
    relation_type: Mapped[Optional[str]] = mapped_column(String(32),
                                                          comment="qa_input/qa_evidence/qa_report/cover/final 等")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    asset: Mapped["Asset"] = relationship(back_populates="links")


# ─── 11. jobs ───────────────────────────────────────────────────────────────

class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    project_id: Mapped[Optional[str]] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"), index=True)
    job_type: Mapped[str] = mapped_column(String(64), nullable=False,
                                          comment="regenerate_scene/generate_video/mix_audio/export 等")
    target_type: Mapped[Optional[str]] = mapped_column(String(32), comment="scene/episode/asset")
    target_id: Mapped[Optional[str]] = mapped_column(String(32), index=True)
    worker_type: Mapped[Optional[str]] = mapped_column(String(32), comment="script/visual/audio/qa/edit/publish/ffmpeg")
    status: Mapped[str] = mapped_column(String(32), default="pending",
                                        comment="pending/running/completed/failed/cancelled")
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    cost_actual: Mapped[Optional[float]] = mapped_column(Float)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    steps: Mapped[list["JobStep"]] = relationship(back_populates="job", cascade="all, delete-orphan")


# ─── 12. job_steps ──────────────────────────────────────────────────────────

class JobStep(Base):
    __tablename__ = "job_steps"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    step_key: Mapped[str] = mapped_column(String(64), nullable=False,
                                          comment="init/start/build_prompt/invoke_comfyui/upload_asset 等")
    tool_name: Mapped[Optional[str]] = mapped_column(String(64), comment="comfyui/ffmpeg/kling_api 等")
    input_json: Mapped[Optional[dict]] = mapped_column(JSON, comment="步骤输入参数")
    output_json: Mapped[Optional[dict]] = mapped_column(JSON, comment="步骤输出结果")
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSON, comment="fallback_records 等")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    job: Mapped["Job"] = relationship(back_populates="steps")


# ─── 13. qa_runs ────────────────────────────────────────────────────────────

class QARun(Base):
    __tablename__ = "qa_runs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    project_id: Mapped[Optional[str]] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"))
    gate_code: Mapped[str] = mapped_column(String(16), nullable=False, comment="G1a~G12")
    subject_type: Mapped[str] = mapped_column(String(32), nullable=False,
                                              comment="scene/scene_version/episode/asset")
    subject_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True, comment="被检查对象 ID")
    input_asset_id: Mapped[Optional[str]] = mapped_column(String(32), comment="本次检测输入资产")
    evidence_asset_id: Mapped[Optional[str]] = mapped_column(String(32), comment="主证据资产")
    step_key: Mapped[Optional[str]] = mapped_column(String(64), comment="image_gen/video_gen/mix/export")
    status: Mapped[str] = mapped_column(String(32), default="pending",
                                        comment="pending/passed/failed/needs_review")
    score_json: Mapped[Optional[dict]] = mapped_column(JSON, comment="检测分数")
    threshold_snapshot: Mapped[Optional[dict]] = mapped_column(JSON, comment="当时使用的阈值")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    issues: Mapped[list["QAIssue"]] = relationship(back_populates="qa_run", cascade="all, delete-orphan")


# ─── 14. qa_issues ──────────────────────────────────────────────────────────

class QAIssue(Base):
    __tablename__ = "qa_issues"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    qa_run_id: Mapped[str] = mapped_column(ForeignKey("qa_runs.id", ondelete="CASCADE"), nullable=False)
    issue_code: Mapped[str] = mapped_column(String(64), nullable=False, comment="问题代码")
    severity: Mapped[str] = mapped_column(String(16), nullable=False, comment="critical/warning/info")
    message: Mapped[str] = mapped_column(Text, nullable=False, comment="问题描述")
    evidence_asset_id: Mapped[Optional[str]] = mapped_column(String(32))
    related_asset_id: Mapped[Optional[str]] = mapped_column(String(32), comment="问题直接关联资产")
    related_scene_version_id: Mapped[Optional[str]] = mapped_column(String(32), comment="问题归属版本")
    suggested_action: Mapped[Optional[str]] = mapped_column(Text, comment="建议修复动作")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    qa_run: Mapped["QARun"] = relationship(back_populates="issues")


# ─── 15. publish_jobs ───────────────────────────────────────────────────────

class PublishJob(Base):
    __tablename__ = "publish_jobs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    project_id: Mapped[Optional[str]] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"), index=True)
    episode_id: Mapped[Optional[str]] = mapped_column(ForeignKey("episodes.id", ondelete="SET NULL"))
    platform: Mapped[Optional[str]] = mapped_column(String(32), comment="tiktok/douyin")
    status: Mapped[str] = mapped_column(String(32), default="pending")
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    payload_json: Mapped[Optional[dict]] = mapped_column(JSON, comment="发布参数")
    external_post_id: Mapped[Optional[str]] = mapped_column(String(128), comment="平台返回的帖子 ID")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    variants: Mapped[list["PublishVariant"]] = relationship(back_populates="publish_job", cascade="all, delete-orphan")
    delivery_packages: Mapped[list["DeliveryPackage"]] = relationship(back_populates="publish_job", cascade="all, delete-orphan")


# ─── 16. publish_variants ───────────────────────────────────────────────────

class PublishVariant(Base):
    __tablename__ = "publish_variants"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    publish_job_id: Mapped[str] = mapped_column(ForeignKey("publish_jobs.id", ondelete="CASCADE"), nullable=False)
    platform: Mapped[Optional[str]] = mapped_column(String(32))
    title: Mapped[Optional[str]] = mapped_column(String(256))
    caption: Mapped[Optional[str]] = mapped_column(Text)
    hashtags: Mapped[Optional[list]] = mapped_column(JSON, comment="标签列表")
    cover_asset_id: Mapped[Optional[str]] = mapped_column(String(32))
    is_selected: Mapped[bool] = mapped_column(Boolean, default=False, comment="是否选中用于发布")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    publish_job: Mapped["PublishJob"] = relationship(back_populates="variants")
    delivery_package_id: Mapped[Optional[str]] = mapped_column(ForeignKey("delivery_packages.id", ondelete="SET NULL"), comment="关联交付包 ID")
    resolution: Mapped[Optional[str]] = mapped_column(String(32), comment="分辨率（1080x1920/720x1280 等）")
    aspect_ratio: Mapped[Optional[str]] = mapped_column(String(16), comment="画面比例（9:16/1:1/16:9）")
    bitrate: Mapped[Optional[str]] = mapped_column(String(32), comment="码率（如 8M/4M）")
    file_size: Mapped[Optional[int]] = mapped_column(Integer, comment="文件大小（bytes）")
    duration: Mapped[Optional[float]] = mapped_column(Float, comment="时长（秒）")
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSON, comment="变体元数据（编码参数、水印配置等）")
    delivery_package: Mapped[Optional["DeliveryPackage"]] = relationship()


# ─── 20. delivery_packages ────────────────────────────────────────────────
# 041b1 — 交付包：封装 episode 所有可交付资产

class DeliveryPackage(Base):
    __tablename__ = "delivery_packages"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    project_id: Mapped[Optional[str]] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"))
    episode_id: Mapped[Optional[str]] = mapped_column(ForeignKey("episodes.id", ondelete="SET NULL"), index=True)
    publish_job_id: Mapped[Optional[str]] = mapped_column(ForeignKey("publish_jobs.id", ondelete="SET NULL"))
    package_no: Mapped[int] = mapped_column(Integer, nullable=False, comment="包序号（同一 episode 自增）")
    status: Mapped[str] = mapped_column(String(32), default="BUILDING",
                                         comment="BUILDING/READY/PUBLISHED/FAILED")
    total_size: Mapped[Optional[int]] = mapped_column(Integer, comment="总文件大小（bytes）")
    asset_count: Mapped[int] = mapped_column(Integer, default=0, comment="包含资产数量")
    checksum: Mapped[Optional[str]] = mapped_column(String(64), comment="包级 SHA256 校验和")
    manifest_json: Mapped[Optional[dict]] = mapped_column(JSON, comment="包清单（资产 ID 列表 + 各平台变体映射）")
    built_at: Mapped[Optional[datetime]] = mapped_column(DateTime, comment="构建完成时间")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    publish_job: Mapped[Optional["PublishJob"]] = relationship(back_populates="delivery_packages")


# ─── 17. analytics_snapshots ────────────────────────────────────────────────

class AnalyticsSnapshot(Base):
    __tablename__ = "analytics_snapshots"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    project_id: Mapped[Optional[str]] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"))
    episode_id: Mapped[Optional[str]] = mapped_column(ForeignKey("episodes.id", ondelete="SET NULL"))
    publish_job_id: Mapped[Optional[str]] = mapped_column(ForeignKey("publish_jobs.id", ondelete="SET NULL"),
                                                      comment="关联发布任务 ID（041b3）")
    platform: Mapped[Optional[str]] = mapped_column(String(32))
    external_post_id: Mapped[Optional[str]] = mapped_column(String(128))
    views: Mapped[Optional[int]] = mapped_column(Integer)
    completion_rate: Mapped[Optional[float]] = mapped_column(Float, comment="完播率")
    likes: Mapped[Optional[int]] = mapped_column(Integer)
    comments: Mapped[Optional[int]] = mapped_column(Integer)
    shares: Mapped[Optional[int]] = mapped_column(Integer)
    watch_time: Mapped[Optional[float]] = mapped_column(Float, comment="总观看时长（秒）")
    source: Mapped[Optional[str]] = mapped_column(String(32), default="manual",
                                                   comment="数据来源：manual/api_import/webhook")
    snapshot_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


# ─── 18. knowledge_items ────────────────────────────────────────────────────

class KnowledgeItem(Base):
    __tablename__ = "knowledge_items"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    project_id: Mapped[Optional[str]] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"), index=True)
    episode_id: Mapped[Optional[str]] = mapped_column(ForeignKey("episodes.id", ondelete="SET NULL"),
                                                     comment="关联剧集 ID（041b3）")
    publish_job_id: Mapped[Optional[str]] = mapped_column(ForeignKey("publish_jobs.id", ondelete="SET NULL"),
                                                          comment="关联发布任务 ID（041b3）")
    analytics_snapshot_id: Mapped[Optional[str]] = mapped_column(String(32),
                                                                comment="来源分析快照 ID（041b3）")
    category: Mapped[str] = mapped_column(String(32), nullable=False,
                                          comment="success/failure/hook/rule/playbook")
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    content: Mapped[Optional[str]] = mapped_column(Text)
    tags: Mapped[Optional[list]] = mapped_column(JSON, comment="标签列表")
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSON)
    confidence: Mapped[Optional[float]] = mapped_column(Float, default=1.0,
                                                        comment="置信度 0~1（041b3）")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True,
                                            comment="是否生效（041b3）")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    project: Mapped["Project"] = relationship(back_populates="knowledge_items")


# ─── 19. api_keys ───────────────────────────────────────────────────────────

class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(128), nullable=False, comment="密钥名称/用途")
    key_hash: Mapped[str] = mapped_column(String(128), nullable=False, comment="密钥哈希（不存明文）")
    key_prefix: Mapped[str] = mapped_column(String(16), nullable=False, comment="密钥前缀（用于识别，如 mj_abc1）")
    provider: Mapped[Optional[str]] = mapped_column(String(64), comment="kling/seedance/elevenlabs/fish 等")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)


# ─── 22. locations ─────────────────────────────────────────────────────────

class Location(Base):
    __tablename__ = "locations"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(256), nullable=False, comment="地点名称（如：灵异古铺、现代办公室）")
    description: Mapped[Optional[str]] = mapped_column(Text, comment="地点描述")
    visual_style: Mapped[Optional[str]] = mapped_column(String(256), comment="视觉风格描述")
    reference_asset_id: Mapped[Optional[str]] = mapped_column(String(32), comment="参考图资产 ID")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    project: Mapped["Project"] = relationship(back_populates="locations")


# ─── 21. job_events ─────────────────────────────────────────────────────────

class JobEvent(Base):
    __tablename__ = "job_events"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    job_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(32), default="progress")
    step_key: Mapped[Optional[str]] = mapped_column(String(64))
    job_status: Mapped[Optional[str]] = mapped_column(String(32))
    step_status: Mapped[Optional[str]] = mapped_column(String(32))
    progress_percent: Mapped[Optional[int]] = mapped_column(Integer)
    message: Mapped[Optional[str]] = mapped_column(Text)
    payload_json: Mapped[Optional[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


# ─── 23. script_parse_reports ─────────────────────────────────────────────

class ScriptParseReport(Base):
    __tablename__ = "script_parse_reports"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    episode_id: Mapped[str] = mapped_column(ForeignKey("episodes.id", ondelete="CASCADE"), nullable=False)
    total_shots: Mapped[int] = mapped_column(Integer, default=0, comment="解析出的镜头总数")
    parsed_shots: Mapped[int] = mapped_column(Integer, default=0, comment="成功解析的镜头数")
    failed_shots: Mapped[int] = mapped_column(Integer, default=0, comment="解析失败的镜头数")
    parse_method: Mapped[str] = mapped_column(String(32), default="rule", comment="解析方式：rule/llm")
    raw_issues: Mapped[Optional[dict]] = mapped_column(JSON, comment="原始解析问题")
    status: Mapped[str] = mapped_column(String(32), default="completed", comment="completed/partial/failed")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    shot_reports: Mapped[list["ShotImportReport"]] = relationship(back_populates="parse_report", cascade="all, delete-orphan")
    issues: Mapped[list["ScriptIssue"]] = relationship(back_populates="parse_report", cascade="all, delete-orphan")


# ─── 24. shot_import_reports ───────────────────────────────────────────────

class ShotImportReport(Base):
    __tablename__ = "shot_import_reports"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    parse_report_id: Mapped[str] = mapped_column(ForeignKey("script_parse_reports.id", ondelete="CASCADE"), nullable=False)
    scene_id: Mapped[Optional[str]] = mapped_column(String(32), comment="关联的 Scene(Shot) ID")
    shot_no: Mapped[Optional[int]] = mapped_column(Integer, comment="镜号")
    title: Mapped[Optional[str]] = mapped_column(String(256), comment="镜头标题")
    location_name: Mapped[Optional[str]] = mapped_column(String(256), comment="识别到的地点名称")
    character_names: Mapped[Optional[dict]] = mapped_column(JSON, comment="识别到的角色名列表")
    dialogue: Mapped[Optional[str]] = mapped_column(Text, comment="对白内容")
    action: Mapped[Optional[str]] = mapped_column(Text, comment="动作描述")
    estimated_duration: Mapped[Optional[float]] = mapped_column(Float, comment="预计时长（秒）")
    prop_hints: Mapped[Optional[dict]] = mapped_column(JSON, comment="道具提示列表")
    import_status: Mapped[str] = mapped_column(String(32), default="success", comment="success/skipped/error")
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    parse_report: Mapped["ScriptParseReport"] = relationship(back_populates="shot_reports")


# ─── 25. script_issues ─────────────────────────────────────────────────────

class ScriptIssue(Base):
    __tablename__ = "script_issues"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    parse_report_id: Mapped[str] = mapped_column(ForeignKey("script_parse_reports.id", ondelete="CASCADE"), nullable=False)
    issue_type: Mapped[str] = mapped_column(String(32), comment="解析问题类型：ambiguous_character/missing_location/unclear_action/format_error/unknown")
    severity: Mapped[str] = mapped_column(String(16), default="warning", comment="warning/error")
    line_number: Mapped[Optional[int]] = mapped_column(Integer, comment="原文行号")
    original_text: Mapped[Optional[str]] = mapped_column(Text, comment="原始文本片段")
    message: Mapped[Optional[str]] = mapped_column(Text, comment="问题描述")
    suggested_fix: Mapped[Optional[str]] = mapped_column(Text, comment="建议修复方式")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    parse_report: Mapped["ScriptParseReport"] = relationship(back_populates="issues")


# ─── 26. props ──────────────────────────────────────────────────────────────

class Prop(Base):
    __tablename__ = "props"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False, comment="道具名称（如：古玉、照片、钥匙）")
    description: Mapped[Optional[str]] = mapped_column(Text, comment="道具描述")
    category: Mapped[Optional[str]] = mapped_column(String(64), comment="道具类别：weapon/document/electronic/clothing/other")
    reference_asset_id: Mapped[Optional[str]] = mapped_column(String(32), comment="参考图资产 ID")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    project: Mapped["Project"] = relationship(back_populates="props")


# ─── 27. prop_states ────────────────────────────────────────────────────────

class PropState(Base):
    __tablename__ = "prop_states"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    prop_id: Mapped[str] = mapped_column(ForeignKey("props.id", ondelete="CASCADE"), nullable=False)
    scene_id: Mapped[Optional[str]] = mapped_column(ForeignKey("scenes.id", ondelete="SET NULL"), comment="关联镜头 ID")
    state_description: Mapped[Optional[str]] = mapped_column(Text, comment="状态描述（如：完好、碎裂、发光）")
    visual_notes: Mapped[Optional[str]] = mapped_column(Text, comment="视觉提示（如：泛着绿光、有裂纹）")
    changed_from_state_id: Mapped[Optional[str]] = mapped_column(String(32), comment="从哪个状态变更而来")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    prop: Mapped["Prop"] = relationship()
    scene: Mapped[Optional["Scene"]] = relationship()


# ─── 26. still_candidates ─────────────────────────────────────────────────

class StillCandidate(Base):
    __tablename__ = "still_candidates"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    scene_id: Mapped[str] = mapped_column(ForeignKey("scenes.id", ondelete="CASCADE"), nullable=False, index=True, comment="关联镜头 ID")
    version: Mapped[int] = mapped_column(Integer, default=1, comment="候选版本号")
    image_path: Mapped[str] = mapped_column(String(512), comment="静帧图片存储路径")
    thumbnail_path: Mapped[Optional[str]] = mapped_column(String(512), comment="缩略图路径")
    prompt_used: Mapped[Optional[str]] = mapped_column(Text, comment="生成时使用的 prompt")
    seed: Mapped[Optional[int]] = mapped_column(Integer, comment="生成 seed")
    status: Mapped[str] = mapped_column(String(16), default="pending", comment="候选状态：pending/approved/rejected")
    review_note: Mapped[Optional[str]] = mapped_column(Text, comment="审核备注")
    reviewed_by: Mapped[Optional[str]] = mapped_column(String(64), comment="审核人")
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, comment="审核时间")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    scene: Mapped["Scene"] = relationship(back_populates="still_candidates")


# ─── 28. prompt_templates ───────────────────────────────────────────────────

class PromptTemplate(Base):
    __tablename__ = "prompt_templates"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False, comment="模板名称")
    category: Mapped[str] = mapped_column(String(64), default="general", comment="模板类别：character/location/prop/action/style/general")
    template_text: Mapped[Optional[str]] = mapped_column(Text, comment="模板文本，可用 {character_desc} {location_desc} 等占位符")
    version: Mapped[int] = mapped_column(Integer, default=1, comment="模板版本号")
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, comment="是否为默认模板")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    project: Mapped["Project"] = relationship(back_populates="prompt_templates")


# ─── 30. complexity_profiles ──────────────────────────────────────────────

# ─── 31. cost_records ────────────────────────────────────────────────────────

class CostRecord(Base):
    __tablename__ = "cost_records"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    scene_id: Mapped[Optional[str]] = mapped_column(ForeignKey("scenes.id", ondelete="SET NULL"), comment="关联镜头 ID")
    scene_version_id: Mapped[Optional[str]] = mapped_column(String(32), comment="关联版本 ID")
    job_id: Mapped[Optional[str]] = mapped_column(String(32), comment="关联 Job ID")

    cost_type: Mapped[str] = mapped_column(String(32), nullable=False, comment="成本类型：image_generate/video_generate/audio_generate/storage/api_call")
    provider: Mapped[Optional[str]] = mapped_column(String(64), comment="Provider 名称：kling/seedance/mock 等")
    model: Mapped[Optional[str]] = mapped_column(String(64), comment="使用的模型")

    # 计量
    input_tokens: Mapped[Optional[int]] = mapped_column(Integer, comment="输入 token 数")
    output_tokens: Mapped[Optional[int]] = mapped_column(Integer, comment="输出 token 数")
    duration_seconds: Mapped[Optional[float]] = mapped_column(Float, comment="生成内容时长（秒）")
    api_calls: Mapped[int] = mapped_column(Integer, default=1, comment="API 调用次数")
    retry_count: Mapped[int] = mapped_column(Integer, default=0, comment="重试次数")

    # 费用（单位：美元）
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0, comment="实际费用")
    estimated_cost_usd: Mapped[Optional[float]] = mapped_column(Float, comment="估算费用（用于无实际计费时）")

    # 元数据
    metadata_json: Mapped[Optional[str]] = mapped_column(Text, comment="额外信息 JSON")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    project: Mapped["Project"] = relationship()
    scene: Mapped[Optional["Scene"]] = relationship()


# ─── 30. complexity_profiles ──────────────────────────────────────────────

class ComplexityProfile(Base):
    __tablename__ = "complexity_profiles"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    scene_id: Mapped[str] = mapped_column(ForeignKey("scenes.id", ondelete="CASCADE"), nullable=False, unique=True, comment="关联镜头 ID")
    overall_score: Mapped[float] = mapped_column(Float, comment="综合复杂度评分 0.0-10.0")
    character_count: Mapped[int] = mapped_column(Integer, default=0, comment="角色数量")
    has_location: Mapped[bool] = mapped_column(Boolean, default=False, comment="是否有地点")
    duration_score: Mapped[float] = mapped_column(Float, default=0, comment="时长复杂度分")
    character_score: Mapped[float] = mapped_column(Float, default=0, comment="角色复杂度分")
    action_score: Mapped[float] = mapped_column(Float, default=0, comment="动作复杂度分")
    style_score: Mapped[float] = mapped_column(Float, default=0, comment="风格复杂度分")
    breakdown: Mapped[Optional[str]] = mapped_column(Text, comment="评分明细 JSON")
    calculated_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    scene: Mapped["Scene"] = relationship()


# ─── 0. users (auth) ────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(256), unique=True, nullable=False, index=True, comment="登录邮箱")
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False, comment="bcrypt 哈希")
    display_name: Mapped[Optional[str]] = mapped_column(String(128), comment="显示名称")
    role: Mapped[str] = mapped_column(String(32), default="admin", comment="角色: admin/operator/viewer")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, comment="是否启用")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime, comment="最后登录时间")
