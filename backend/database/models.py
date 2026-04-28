"""Manju Production OS — 全部 19 个 ORM 模型

模型清单：
1.  projects           2.  project_configs     3.  story_bibles
4.  characters          5.  character_assets    6.  episodes
7.  scenes              8.  scene_versions      9.  assets
10. asset_links         11. jobs               12. job_steps
13. qa_runs             14. qa_issues          15. publish_jobs
16. publish_variants    17. analytics_snapshots 18. knowledge_items
19. api_keys
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


# ─── 2. project_configs ─────────────────────────────────────────────────────

class ProjectConfig(Base):
    __tablename__ = "project_configs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    config_key: Mapped[str] = mapped_column(String(128), nullable=False, comment="配置键")
    config_value_json: Mapped[Optional[dict]] = mapped_column(JSON, comment="配置值（JSON）")
    version: Mapped[int] = mapped_column(Integer, default=1, comment="配置版本号")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    project: Mapped["Project"] = relationship(back_populates="configs")


# ─── 3. story_bibles ────────────────────────────────────────────────────────

class StoryBible(Base):
    __tablename__ = "story_bibles"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(256), comment="标题")
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
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False, comment="角色名")
    role_type: Mapped[Optional[str]] = mapped_column(String(32), comment="主角/配角/反派/路人")
    description: Mapped[Optional[str]] = mapped_column(Text, comment="角色描述")
    voice_profile: Mapped[Optional[dict]] = mapped_column(JSON, comment="声音配置（provider/voice_id/params）")
    canonical_asset_id: Mapped[Optional[str]] = mapped_column(String(32), comment="代表资产 ID")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    project: Mapped["Project"] = relationship(back_populates="characters")
    assets: Mapped[list["CharacterAsset"]] = relationship(back_populates="character", cascade="all, delete-orphan")


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
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
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


# ─── 7. scenes ──────────────────────────────────────────────────────────────

class Scene(Base):
    __tablename__ = "scenes"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    episode_id: Mapped[str] = mapped_column(ForeignKey("episodes.id", ondelete="CASCADE"), nullable=False)
    scene_no: Mapped[int] = mapped_column(Integer, comment="镜头序号")
    title: Mapped[Optional[str]] = mapped_column(String(256))
    duration: Mapped[Optional[float]] = mapped_column(Float, comment="时长（秒）")
    status: Mapped[str] = mapped_column(String(32), default="DRAFT")
    locked_version_id: Mapped[Optional[str]] = mapped_column(String(32), comment="锁定版本 ID")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    episode: Mapped["Episode"] = relationship(back_populates="scenes")
    versions: Mapped[list["SceneVersion"]] = relationship(back_populates="scene", cascade="all, delete-orphan")


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
    project_id: Mapped[Optional[str]] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"))
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
    #   watermark_proof, qa_evidence, detection_json

    links: Mapped[list["AssetLink"]] = relationship(back_populates="asset", cascade="all, delete-orphan")


# ─── 10. asset_links ────────────────────────────────────────────────────────

class AssetLink(Base):
    __tablename__ = "asset_links"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    asset_id: Mapped[str] = mapped_column(ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    owner_type: Mapped[str] = mapped_column(String(32), nullable=False,
                                             comment="scene/scene_version/qa_run/episode/publish_job")
    owner_id: Mapped[str] = mapped_column(String(32), nullable=False, comment="归属对象 ID")
    relation_type: Mapped[Optional[str]] = mapped_column(String(32),
                                                          comment="qa_input/qa_evidence/qa_report/cover/final 等")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    asset: Mapped["Asset"] = relationship(back_populates="links")


# ─── 11. jobs ───────────────────────────────────────────────────────────────

class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    project_id: Mapped[Optional[str]] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"))
    job_type: Mapped[str] = mapped_column(String(64), nullable=False,
                                          comment="regenerate_scene/generate_video/mix_audio/export 等")
    target_type: Mapped[Optional[str]] = mapped_column(String(32), comment="scene/episode/asset")
    target_id: Mapped[Optional[str]] = mapped_column(String(32))
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
    subject_id: Mapped[str] = mapped_column(String(32), nullable=False, comment="被检查对象 ID")
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
    project_id: Mapped[Optional[str]] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"))
    episode_id: Mapped[Optional[str]] = mapped_column(ForeignKey("episodes.id", ondelete="SET NULL"))
    platform: Mapped[Optional[str]] = mapped_column(String(32), comment="tiktok/douyin")
    status: Mapped[str] = mapped_column(String(32), default="pending")
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    payload_json: Mapped[Optional[dict]] = mapped_column(JSON, comment="发布参数")
    external_post_id: Mapped[Optional[str]] = mapped_column(String(128), comment="平台返回的帖子 ID")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    variants: Mapped[list["PublishVariant"]] = relationship(back_populates="publish_job", cascade="all, delete-orphan")


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


# ─── 17. analytics_snapshots ────────────────────────────────────────────────

class AnalyticsSnapshot(Base):
    __tablename__ = "analytics_snapshots"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    project_id: Mapped[Optional[str]] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"))
    episode_id: Mapped[Optional[str]] = mapped_column(String(32))
    platform: Mapped[Optional[str]] = mapped_column(String(32))
    external_post_id: Mapped[Optional[str]] = mapped_column(String(128))
    views: Mapped[Optional[int]] = mapped_column(Integer)
    completion_rate: Mapped[Optional[float]] = mapped_column(Float, comment="完播率")
    likes: Mapped[Optional[int]] = mapped_column(Integer)
    comments: Mapped[Optional[int]] = mapped_column(Integer)
    shares: Mapped[Optional[int]] = mapped_column(Integer)
    watch_time: Mapped[Optional[float]] = mapped_column(Float, comment="总观看时长（秒）")
    snapshot_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


# ─── 18. knowledge_items ────────────────────────────────────────────────────

class KnowledgeItem(Base):
    __tablename__ = "knowledge_items"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    project_id: Mapped[Optional[str]] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"))
    category: Mapped[str] = mapped_column(String(32), nullable=False,
                                          comment="success/failure/hook/rule/playbook")
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    content: Mapped[Optional[str]] = mapped_column(Text)
    tags: Mapped[Optional[list]] = mapped_column(JSON, comment="标签列表")
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSON)
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
