/** TypeScript 类型定义 */

export type ProjectStatus = 'active' | 'in_production' | 'completed' | 'archived' | 'DRAFT'

export interface ProjectCreate {
  name: string
  genre?: string
  market?: string
  platform?: string
  tier?: string
  budget_limit?: number
  description?: string
}

export interface ProjectUpdate {
  name?: string
  genre?: string
  market?: string
  platform?: string
  tier?: string
  budget_limit?: number
  status?: string
  description?: string
}

export interface ApiKeyCreate {
  name: string
  provider?: string
}

export interface ApiKeyCreated extends Omit<ApiKey, 'is_active' | 'last_used_at' | 'updated_at'> {
  key: string
}

export interface Project {
  id: string
  name: string
  genre?: string
  market?: string
  platform?: string
  tier?: string
  budget_limit?: number
  status: string
  description?: string
  created_at: string
  updated_at: string
}

export interface ApiKey {
  id: string
  name: string
  key_prefix: string
  provider?: string
  is_active: boolean
  last_used_at?: string
  created_at: string
  updated_at: string
}

// ── Episode ──

export interface Episode {
  id: string
  project_id: string
  episode_no: number
  title?: string
  outline?: string
  script?: string
  duration?: number
  status: string
  scene_count?: number
  scenes?: Scene[]
  created_at?: string
  updated_at?: string
}

// ── Scene ──

export interface Scene {
  id: string
  episode_id: string
  scene_no: number
  title?: string
  duration?: number
  status: string
  locked_version_id?: string
  latest_version?: SceneVersion
  created_at?: string
}

// ── SceneVersion ──

export interface SceneVersion {
  id: string
  scene_id: string
  parent_version_id?: string
  version_no: number
  status: string
  prompt_bundle?: Record<string, unknown>
  model_bundle?: Record<string, unknown>
  params?: Record<string, unknown>
  change_reason?: string
  score_snapshot?: Record<string, number>
  cost_actual?: number
  created_at?: string
}

// ── Job ──

export type JobStatus = 'queued' | 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export type StepStatus = 'queued' | 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

export interface Job {
  id: string
  project_id?: string
  job_type: string
  target_type?: string
  target_id?: string
  worker_type?: string
  status: JobStatus
  retry_count: number
  cost_actual?: number
  error_message?: string
  metadata_json?: Record<string, unknown>
  steps?: JobStep[]
  progress?: ProgressEvent
  created_at?: string
  started_at?: string
  finished_at?: string
}

export interface JobStep {
  id: string
  step_key: string
  tool_name?: string
  status: StepStatus
  input_json?: Record<string, unknown>
  output_json?: Record<string, unknown>
  error_message?: string
  finished_at?: string
}

// ── Progress Event (unified schema for WS / polling) ──

export interface ProgressEvent {
  project_id: string
  episode_id?: string
  scene_id: string
  scene_version_id: string
  job_id: string
  step_key: string
  job_status: string
  step_status: string
  progress_percent: number
  message: string
  timestamp: string
}

// ── Asset ──

export interface Asset {
  id: string
  project_id?: string
  type: string
  uri?: string
  mime_type?: string
  file_size?: number
  duration?: number
  width?: number
  height?: number
  metadata_json?: Record<string, unknown>
  checksum?: string
  created_at?: string
  links?: AssetLink[]
}

export interface AssetLink {
  id: string
  owner_type: string
  owner_id: string
  relation_type?: string
}

// ── QA ──

export interface QARun {
  id: string
  project_id?: string
  gate_code: string
  subject_type: string
  subject_id: string
  step_key?: string
  status: 'pending' | 'passed' | 'failed' | 'needs_review'
  score_json?: Record<string, number>
  threshold_snapshot?: Record<string, number>
  issues?: QAIssue[]
  created_at?: string
  finished_at?: string
}

export interface QAIssue {
  id: string
  qa_run_id: string
  issue_code: string
  severity: 'critical' | 'warning' | 'info'
  message: string
  suggested_action?: string
  related_scene_version_id?: string
  created_at?: string
}
