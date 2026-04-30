// ArcLine shared type definitions
// Re-exports from api-client.ts + supplemental enum types

import type {
  VoiceConfig,
  BGMConfig,
  MixConfig,
  EpisodeAudioAssets,
  QAEvidenceAssets,
} from '../lib/api-client';

// ── Re-exports from api-client.ts ───────────────────────────────────────

export type {
  PaginatedResponse,
  ApiError,
  ProjectCreate,
  ProjectUpdate,
  Project,
  ApiKeyCreate,
  ApiKeyCreated,
  ApiKey,
  WorkspaceOverview,
  SeedResponse,
  Episode,
  EpisodeWithScenes,
  EpisodeWithTierInfo,
  LockSceneVersionRequest,
  LockSceneVersionResponse,
  SceneReworkRequest,
  SceneReworkResponse,
  VersionFieldDiff,
  VersionDiffResponse,
  SwitchLockedVersionRequest,
  SwitchLockedVersionResponse,
  SubtitleCue,
  SubtitleEditRequest,
  SubtitleEditResponse,
  AudioMixEditRequest,
  AudioMixEditResponse,
  Scene,
  SceneVersionSummary,
  SceneVersion,
  SceneVersionTreeResponse,
  SceneVersionTreeNode,
  FallbackHistoryResponse,
  FallbackRecord,
  QARun,
  QAIssue,
  QARunDetail,
  Asset,
  AssetWithLinks,
  AssetLink,
  JobStep,
  JobProgress,
  JobDetail,
  UploadResponse,
  VoiceConfig,
  BGMConfig,
  MixConfig,
  AudioConfig,
  EpisodeAudioConfig,
  EpisodeAudioAssets,
  QAEvidenceAssets,
  RuleExecutionResult,
  RulesReportResponse,
  StoryBibleCreate,
  StoryBibleUpdate,
  StoryBible,
  CharacterCreate,
  CharacterUpdate,
  Character,
  DeliveryPackage,
  DeliveryPackageCreate,
  PublishJob,
  PublishJobCreate,
  Location,
} from '../lib/api-client';

// ── Supplemental enum/union types (not in api-client.ts) ─────────────────

export type ProjectStatus = 'active' | 'in_production' | 'completed' | 'archived' | 'DRAFT';

export type JobStatus = 'queued' | 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type StepStatus = 'queued' | 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

// ── Progress Event (unified schema for WS / polling) ─────────────────────

export interface ProgressEvent {
  project_id: string;
  episode_id?: string;
  scene_id: string;
  scene_version_id: string;
  job_id: string;
  step_key: string;
  job_status: string;
  step_status: string;
  progress_percent: number;
  message: string;
  timestamp: string;
}

// ── 040b Audio Panel types ──────────────────────────────────────────

/** Voice provider + voice ID combined */
export type VoiceInfo = {
  provider: VoiceConfig['provider'];
  voice_id: VoiceConfig['voice_id'];
  voice_params?: VoiceConfig['params'];
};

/** BGM provider + style combined */
export type BGMInfo = {
  provider: BGMConfig['provider'];
  style?: BGMConfig['style'];
  volume?: BGMConfig['volume'];
  fade_in?: BGMConfig['fade_in'];
  fade_out?: BGMConfig['fade_out'];
  loop?: BGMConfig['loop'];
};

/** Mix parameters */
export type MixParams = Pick<MixConfig, 'voice_volume' | 'bgm_volume' | 'sample_rate' | 'format'>;

/** Recent audio assets entry (for 040b panel) */
export type RecentAudioAssets = EpisodeAudioAssets;

/** QA evidence entry (for 040b panel) */
export type QAEvidence = QAEvidenceAssets;
