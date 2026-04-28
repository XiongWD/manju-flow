// ArcLine shared type definitions
// Re-exports from api-client.ts + supplemental enum types

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
  Scene,
  SceneVersionSummary,
  SceneVersion,
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
