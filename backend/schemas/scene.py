"""Scene Pydantic schemas"""

from datetime import datetime
from typing import Optional, Any, List, Dict

from pydantic import BaseModel, Field


class SceneCreate(BaseModel):
    episode_id: str = Field(..., description="所属剧集 ID")
    scene_no: int = Field(..., description="镜头序号")
    title: Optional[str] = Field(None, max_length=256, description="镜头标题")
    duration: Optional[float] = Field(None, description="时长（秒）")
    status: str = Field(default="DRAFT", max_length=32, description="状态")
    location_id: Optional[str] = Field(None, max_length=32, description="关联地点 ID")
    shot_stage: str = Field(default="draft", max_length=32, description="镜头生产阶段：draft/script_parsed/still_generating/still_review/still_locked/video_generating/video_review/video_locked/compose_ready/delivery")


class SceneUpdate(BaseModel):
    scene_no: Optional[int] = Field(None, description="镜头序号")
    title: Optional[str] = Field(None, max_length=256, description="镜头标题")
    duration: Optional[float] = Field(None, description="时长（秒）")
    status: Optional[str] = Field(None, max_length=32, description="状态")
    locked_version_id: Optional[str] = Field(None, max_length=32, description="锁定版本 ID")
    character_ids: Optional[List[str]] = Field(None, description="关联角色 ID 列表")
    location_id: Optional[str] = Field(None, max_length=32, description="关联地点 ID")
    shot_stage: Optional[str] = Field(None, max_length=32, description="镜头生产阶段")


class SceneRead(BaseModel):
    id: str
    episode_id: str
    scene_no: int
    title: Optional[str] = None
    duration: Optional[float] = None
    status: str
    locked_version_id: Optional[str] = None
    character_ids: List[str] = Field(default_factory=list, description="关联角色 ID 列表")
    location_id: Optional[str] = None
    shot_stage: str = "draft"
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SceneVersionRead(BaseModel):
    """场景版本读取模型"""
    id: str
    scene_id: str
    parent_version_id: Optional[str] = None
    version_no: int
    status: str
    prompt_bundle: Optional[dict] = None
    model_bundle: Optional[dict] = None
    params: Optional[dict] = None
    change_reason: Optional[str] = None
    score_snapshot: Optional[dict] = None
    cost_actual: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SceneVersionSummary(BaseModel):
    """场景版本摘要（用于列表/嵌套展示）"""
    id: str
    version_no: int
    status: str
    score_snapshot: Optional[dict] = None
    cost_actual: Optional[float] = None

    model_config = {"from_attributes": True}


class SceneWithVersionSummary(SceneRead):
    """带最新版本摘要的场景"""
    latest_version: Optional[SceneVersionSummary] = None


class SceneWithVersionsRead(SceneRead):
    """带版本列表的场景详情"""
    latest_version: Optional[SceneVersionRead] = None


class FallbackRecord(BaseModel):
    """Fallback 记录（从 job_steps.metadata_json.fallback_records 提取）"""
    from_tier: str = Field(..., description="原 Tier")
    to_tier: str = Field(..., description="降级后 Tier")
    from_provider: str = Field(..., description="原 Provider")
    to_provider: str = Field(..., description="降级后 Provider")
    reason: str = Field(..., description="降级原因")
    trigger_gate: str = Field(..., description="触发降级的门禁代码")
    retry_count: int = Field(default=0, description="重试次数")
    scene_version_id: str = Field(..., description="关联的场景版本 ID")
    timestamp: str = Field(..., description="降级时间戳")


class SceneVersionTreeNode(BaseModel):
    """场景版本树节点（含 fallback_records）"""
    id: str
    version_no: int
    parent_version_id: Optional[str] = None
    status: str
    prompt_bundle: Optional[Dict[str, Any]] = None
    model_bundle: Optional[Dict[str, Any]] = None
    params: Optional[Dict[str, Any]] = None
    change_reason: Optional[str] = None
    score_snapshot: Optional[Dict[str, float]] = None
    cost_actual: Optional[float] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    fallback_records: List[FallbackRecord] = Field(default_factory=list)


class SceneVersionTreeResponse(BaseModel):
    """场景版本树响应（039b）"""
    scene_id: str
    locked_version_id: Optional[str] = None
    versions: List[SceneVersionTreeNode]


class FallbackHistoryResponse(BaseModel):
    """Fallback 历史响应（039b）"""
    scene_id: str
    fallback_records: List[FallbackRecord]


# ─── 042a: 局部返修 + locked_version 切换 + version diff ──────────


class SceneReworkRequest(BaseModel):
    """局部返修请求（042a）
    从指定版本派生新版本，带变更原因。
    """
    scene_version_id: str = Field(..., description="基准版本 ID（新版本的父版本）")
    change_reason: str = Field(..., min_length=1, max_length=512, description="返修原因")
    project_id: str = Field(..., description="项目 ID")
    episode_id: Optional[str] = Field(None, description="剧集 ID")


class SceneReworkResponse(BaseModel):
    """局部返修响应（042a）"""
    job_id: str
    scene_version_id: Optional[str] = Field(None, description="新创建的场景版本 ID")
    parent_version_id: str
    status: str
    message: str


class VersionDiffRequest(BaseModel):
    """版本对比请求（042a）"""
    version_a_id: str = Field(..., description="版本 A ID")
    version_b_id: str = Field(..., description="版本 B ID")


class VersionFieldDiff(BaseModel):
    """单字段差异（042a）"""
    field: str
    label: str
    value_a: Optional[Any] = None
    value_b: Optional[Any] = None
    changed: bool = False


class VersionDiffResponse(BaseModel):
    """版本对比响应（042a）"""
    scene_id: str
    version_a: SceneVersionTreeNode
    version_b: SceneVersionTreeNode
    diffs: List[VersionFieldDiff]
    changed_fields: List[str] = Field(default_factory=list)


class SwitchLockedVersionRequest(BaseModel):
    """切换锁定版本请求（042a）"""
    scene_version_id: str = Field(..., description="新的锁定版本 ID")
    force: bool = Field(default=False, description="是否强制覆盖当前锁定")


class SwitchLockedVersionResponse(BaseModel):
    """切换锁定版本响应（042a）"""
    scene_id: str
    locked_version_id: str
    previous_locked_version_id: Optional[str] = None
    status: str


# ─── 分镜增强: 批量排序 + 批量删除 ──────────────────────


class SceneReorderRequest(BaseModel):
    """批量重排序请求 — 传入 scene_id 列表，按列表顺序重排 scene_no"""
    scene_ids: List[str] = Field(..., min_length=1, description="场景 ID 列表，按目标顺序排列")


class SceneBatchDeleteRequest(BaseModel):
    """批量删除请求"""
    scene_ids: List[str] = Field(..., min_length=1, description="要删除的场景 ID 列表")


class SceneBatchUpdateStatusRequest(BaseModel):
    """批量修改状态请求"""
    scene_ids: List[str] = Field(..., min_length=1, description="场景 ID 列表")
    status: str = Field(..., min_length=1, max_length=32, description="目标状态")


class SceneBatchUpdateDurationRequest(BaseModel):
    """批量调整时长请求"""
    scene_ids: List[str] = Field(..., min_length=1, description="场景 ID 列表")
    mode: str = Field("set", description="调整模式: set / add / multiply")
    value: float = Field(..., description="时长值（秒），mode=set 时为绝对值，mode=add 时为增量，mode=multiply 时为倍率")


# ─── 042b: 字幕编辑 + 音频混音编辑最小闭环 ──────────────────


class SubtitleCue(BaseModel):
    """单条字幕（042b）"""
    index: int = Field(..., description="字幕序号")
    start_time: float = Field(..., ge=0, description="开始时间（秒）")
    end_time: float = Field(..., ge=0, description="结束时间（秒）")
    text: str = Field(..., min_length=1, max_length=512, description="字幕文本")


class SubtitleEditRequest(BaseModel):
    """字幕编辑请求（042b）
    替换 scene_version.params.subtitle 整体。
    """
    cues: List[SubtitleCue] = Field(default_factory=list, description="字幕列表")


class SubtitleEditResponse(BaseModel):
    """字幕编辑响应（042b）"""
    scene_id: str
    scene_version_id: str
    cues: List[SubtitleCue]
    updated: bool


class AudioMixEditRequest(BaseModel):
    """音频混音编辑请求（042b）
    更新 scene_version.params.audio_mix 中的混音参数。
    """
    voice_volume: Optional[float] = Field(None, ge=0, le=2, description="人声音量")
    bgm_volume: Optional[float] = Field(None, ge=0, le=2, description="BGM 音量")
    bgm_fade_in: Optional[float] = Field(None, ge=0, description="BGM 淡入（秒）")
    bgm_fade_out: Optional[float] = Field(None, ge=0, description="BGM 淡出（秒）")


class AudioMixEditResponse(BaseModel):
    """音频混音编辑响应（042b）"""
    scene_id: str
    scene_version_id: str
    voice_volume: float
    bgm_volume: float
    bgm_fade_in: float
    bgm_fade_out: float
    updated: bool
