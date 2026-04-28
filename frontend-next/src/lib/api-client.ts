// ============================================================
// ArcLine API Client — type definitions & fetch skeleton
// ============================================================

// Use absolute URL for server-side rendering
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  (typeof window === "undefined" ? "http://localhost:8000/api" : "/api");

// ── Base types ──────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ── Domain types (aligned with backend snake_case) ───────────────

export interface ProjectCreate {
  name: string;
  genre?: string;
  market?: string;
  platform?: string;
  tier?: string;
  budget_limit?: number;
  description?: string;
}

export interface ProjectUpdate {
  name?: string;
  genre?: string;
  market?: string;
  platform?: string;
  tier?: string;
  budget_limit?: number;
  status?: string;
  description?: string;
}

export interface Project {
  id: string;
  name: string;
  genre?: string;
  market?: string;
  platform?: string;
  tier?: string;
  budget_limit?: number;
  status: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface ApiKeyCreate {
  name: string;
  provider?: string;
}

export interface ApiKeyCreated extends Omit<ApiKey, 'is_active' | 'last_used_at' | 'updated_at'> {
  key: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  provider?: string;
  is_active: boolean;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceOverview {
  project_count?: number;
  episode_count?: number;
  scene_count?: number;
  job_count?: number;
  asset_count?: number;
}

export interface SeedResponse {
  project_id: string;
  episode_id: string;
  message: string;
}

export interface EpisodeCreateInput {
  project_id: string;
  episode_no: number;
  title: string;
  outline?: string;
  script?: string;
  duration?: number;
  status?: string;
}

export interface Episode {
  id: string;
  project_id: string;
  episode_no: number;
  title: string;
  outline?: string;
  script?: string;
  duration?: number;
  status: string;
  current_cut_asset_id?: string;
  created_at: string;
  updated_at: string;
}

export interface EpisodeWithScenes extends Episode {
  scene_count?: number;
  scenes?: Scene[];
}

export interface Scene {
  id: string;
  episode_id: string;
  scene_no: number;
  title?: string;
  duration?: number;
  status: string;
  locked_version_id?: string;
  created_at: string;
  updated_at: string;
  latest_version?: SceneVersion;
}

export interface SceneVersionSummary {
  id: string;
  version_no: number;
  status: string;
  score_snapshot?: Record<string, number>;
  cost_actual?: number;
}

export interface SceneVersion {
  id: string;
  scene_id: string;
  parent_version_id?: string;
  version_no: number;
  status: string;
  prompt_bundle?: Record<string, unknown>;
  model_bundle?: Record<string, unknown>;
  params?: Record<string, unknown>;
  change_reason?: string;
  score_snapshot?: Record<string, number>;
  cost_actual?: number;
  created_at?: string;
  updated_at?: string;
}

export interface QARun {
  id: string;
  project_id: string;
  gate_code: string;
  subject_type: string;
  subject_id: string;
  step_key: string;
  status: string;
  score_json?: Record<string, number>;
  threshold_snapshot?: Record<string, number>;
  created_at: string | null;
  finished_at: string | null;
}

export interface QAIssue {
  id: string;
  qa_run_id: string;
  issue_code: string;
  severity: string;
  message: string;
  suggested_action: string;
  related_scene_version_id?: string;
  created_at: string | null;
}

export interface QARunDetail extends QARun {
  issues: QAIssue[];
}

export interface Asset {
  id: string;
  project_id?: string;
  type: string;
  uri?: string;
  mime_type?: string;
  file_size?: number;
  duration?: number;
  width?: number;
  height?: number;
  metadata_json?: Record<string, unknown>;
  checksum?: string;
  created_at: string;
}

export interface AssetWithLinks extends Asset {
  links?: AssetLink[];
}

export interface AssetLink {
  id: string;
  asset_id: string;
  owner_type: string;
  owner_id: string;
  relation_type?: string;
  created_at: string;
}

export interface JobStep {
  id: string;
  job_id: string;
  step_order: number;
  step_name: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  output_data: string | null;
  error_message: string | null;
}

export interface JobProgress {
  step: string;
  status: string;
  message: string;
  timestamp: string;
}

export interface JobDetail {
  id: string;
  project_id: string;
  job_type: string;
  target_type: string;
  target_id: string;
  worker_type: string;
  status: string;
  retry_count: number;
  cost_actual: number | null;
  error_message: string | null;
  created_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  steps?: JobStep[];
  latest_progress?: JobProgress;
}

export interface UploadResponse {
  asset_id: string;
  uri: string;
  file_size: number;
  mime_type: string;
  message: string;
}

export interface AssetPreviewResponse {
  data: {
    url: string;
    is_presigned: boolean;
    expires_in?: number;
  };
}

// ── API Client ──────────────────────────────────────────────

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) ?? {}),
    };

    const response = await fetch(url, { ...options, headers, redirect: "follow" });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        code: "UNKNOWN",
        message: `Request failed: ${response.status}`,
      }));
      throw error;
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    if (!text) {
      return undefined as T;
    }

    return JSON.parse(text) as T;
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "DELETE" });
  }

  // ── Asset API ──────────────────────────────────────────────

  async listAssets(params?: {
    project_id?: string;
    owner_type?: string;
    owner_id?: string;
    asset_type?: string;
    limit?: number;
  }): Promise<Asset[]> {
    const query = new URLSearchParams();
    if (params?.project_id) query.set("project_id", params.project_id);
    if (params?.owner_type) query.set("owner_type", params.owner_type);
    if (params?.owner_id) query.set("owner_id", params.owner_id);
    if (params?.asset_type) query.set("asset_type", params.asset_type);
    if (params?.limit) query.set("limit", params.limit.toString());
    return this.get<Asset[]>(`assets/?${query.toString()}`);
  }

  async uploadFile(formData: FormData): Promise<UploadResponse> {
    const response = await fetch(`${this.baseUrl}/files/upload`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        code: "UNKNOWN",
        message: `Upload failed: ${response.status}`,
      }));
      throw error;
    }
    return response.json() as Promise<UploadResponse>;
  }

  async getAsset(assetId: string): Promise<AssetWithLinks> {
    return this.get<AssetWithLinks>(`assets/${assetId}`);
  }

  async getAssetPreview(assetId: string): Promise<{ url: string; is_presigned: boolean; expires_in?: number }> {
    const result = await this.get<AssetPreviewResponse>(`files/preview/${assetId}`);
    return result.data;
  }

  async createAssetLink(assetId: string, data: {
    owner_type: string;
    owner_id: string;
    relation_type?: string;
  }): Promise<AssetLink> {
    return this.post<AssetLink>(`assets/${assetId}/links`, data);
  }

  // ── Scene Version API ───────────────────────────────────────────

  async listSceneVersions(sceneId: string): Promise<SceneVersion[]> {
    return this.get<SceneVersion[]>(`scenes/${sceneId}/versions`);
  }

  // ── Job API ─────────────────────────────────────────────────

  async getJob(jobId: string): Promise<JobDetail> {
    return this.get<JobDetail>(`jobs/${jobId}`);
  }

  async listJobs(params?: {
    project_id?: string;
    target_id?: string;
    status?: string;
    limit?: number;
  }): Promise<JobDetail[]> {
    const query = new URLSearchParams();
    if (params?.project_id) query.set("project_id", params.project_id);
    if (params?.target_id) query.set("target_id", params.target_id);
    if (params?.status) query.set("status", params.status);
    if (params?.limit) query.set("limit", params.limit.toString());
    const result = await this.get<{data: JobDetail[]} | JobDetail[]>(`jobs/?${query.toString()}`);
    return Array.isArray(result) ? result : result.data;
  }

  async retryJob(jobId: string): Promise<{
    job_id: string;
    status: string;
    message: string;
  }> {
    return this.post<{ job_id: string; status: string; message: string }>(
      `jobs/${jobId}/retry`
    );
  }

  async cancelJob(jobId: string): Promise<{
    job_id: string;
    status: string;
    message: string;
  }> {
    return this.post<{ job_id: string; status: string; message: string }>(
      `jobs/${jobId}/cancel`
    );
  }

  async getJobProgress(jobId: string): Promise<JobProgress[]> {
    return this.get<JobProgress[]>(`jobs/${jobId}/progress`);
  }

  async getJobLatestProgress(jobId: string): Promise<JobProgress> {
    return this.get<JobProgress>(`jobs/${jobId}/latest-progress`);
  }

  async createMockSceneJob(sceneId: string, projectId: string): Promise<{
    job_id: string;
    status: string;
  }> {
    const query = new URLSearchParams();
    query.set("scene_id", sceneId);
    query.set("project_id", projectId);
    return this.post<{ job_id: string; status: string }>(
      `jobs/mock-scene-job?${query.toString()}`
    );
  }

  // ── Scene API ────────────────────────────────────────────────

  async listScenes(params?: {
    episode_id?: string;
    limit?: number;
  }): Promise<Scene[]> {
    const query = new URLSearchParams();
    if (params?.episode_id) query.set("episode_id", params.episode_id);
    if (params?.limit) query.set("limit", params.limit.toString());
    return this.get<Scene[]>(`scenes/?${query.toString()}`);
  }

  async getScene(sceneId: string): Promise<Scene> {
    return this.get<Scene>(`scenes/${sceneId}`);
  }

  async createScene(data: {
    episode_id: string;
    scene_no: number;
    title?: string;
    duration?: number;
    status?: string;
  }): Promise<Scene> {
    return this.post<Scene>('scenes/', data);
  }

  async updateScene(sceneId: string, data: {
    scene_no?: number;
    title?: string;
    duration?: number;
    status?: string;
    locked_version_id?: string;
  }): Promise<Scene> {
    return this.request<Scene>(`scenes/${sceneId}`, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async deleteScene(sceneId: string): Promise<void> {
    return this.delete<void>(`scenes/${sceneId}`);
  }

  async retryScene(sceneId: string, projectId: string, episodeId?: string): Promise<{
    job_id: string;
    status: string;
    message: string;
  }> {
    const query = new URLSearchParams();
    query.set("project_id", projectId);
    if (episodeId) query.set("episode_id", episodeId);
    return this.post<{job_id: string; status: string; message: string}>(
      `scenes/${sceneId}/retry?${query.toString()}`
    );
  }

  // ── QA API ────────────────────────────────────────────────

  async listQARuns(params?: {
    project_id?: string;
    subject_type?: string;
    subject_id?: string;
    limit?: number;
  }): Promise<QARun[]> {
    const query = new URLSearchParams();
    if (params?.project_id) query.set("project_id", params.project_id);
    if (params?.subject_type) query.set("subject_type", params.subject_type);
    if (params?.subject_id) query.set("subject_id", params.subject_id);
    if (params?.limit) query.set("limit", params.limit.toString());
    const result = await this.get<{data: QARun[]} | QARun[]>(`qa/runs?${query.toString()}`);
    return Array.isArray(result) ? result : result.data;
  }

  async getQARun(runId: string): Promise<QARunDetail> {
    const result = await this.get<{data: QARunDetail} | QARunDetail>(`qa/runs/${runId}`);
    return "data" in result ? result.data : result;
  }

  async listQAIssues(params?: {
    project_id?: string;
    severity?: string;
    limit?: number;
  }): Promise<QAIssue[]> {
    const query = new URLSearchParams();
    if (params?.project_id) query.set("project_id", params.project_id);
    if (params?.severity) query.set("severity", params.severity);
    if (params?.limit) query.set("limit", params.limit.toString());
    const result = await this.get<{data: QAIssue[]} | QAIssue[]>(`qa/issues?${query.toString()}`);
    return Array.isArray(result) ? result : result.data;
  }

  // ── Project API ─────────────────────────────────────────────

  async listProjects(): Promise<Project[]> {
    return this.get<Project[]>('projects');
  }

  async getProject(projectId: string): Promise<Project> {
    return this.get<Project>(`projects/${projectId}`);
  }

  async createProject(data: ProjectCreate): Promise<Project> {
    return this.post<Project>('projects/', data);
  }

  async updateProject(projectId: string, data: ProjectUpdate): Promise<Project> {
    return this.request<Project>(`projects/${projectId}`, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async deleteProject(projectId: string): Promise<void> {
    return this.delete<void>(`projects/${projectId}`);
  }

  // ── ApiKey API ───────────────────────────────────────────────

  async listApiKeys(): Promise<ApiKey[]> {
    return this.get<ApiKey[]>('apikeys');
  }

  async getApiKey(apiKeyId: string): Promise<ApiKey> {
    return this.get<ApiKey>(`apikeys/${apiKeyId}`);
  }

  async createApiKey(data: ApiKeyCreate): Promise<ApiKeyCreated> {
    return this.post<ApiKeyCreated>('apikeys/', data);
  }

  async updateApiKey(apiKeyId: string, data: {
    name?: string;
    provider?: string;
    is_active?: boolean;
  }): Promise<ApiKey> {
    return this.request<ApiKey>(`apikeys/${apiKeyId}`, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async deleteApiKey(apiKeyId: string): Promise<void> {
    return this.delete<void>(`apikeys/${apiKeyId}`);
  }

  // ── Episode API ─────────────────────────────────────────────

  async listEpisodes(params?: {
    project_id?: string;
    limit?: number;
  }): Promise<Episode[]> {
    const query = new URLSearchParams();
    if (params?.project_id) query.set("project_id", params.project_id);
    if (params?.limit) query.set("limit", params.limit.toString());
    return this.get<Episode[]>(`episodes/?${query.toString()}`);
  }

  async createEpisode(data: EpisodeCreateInput): Promise<Episode> {
    return this.post<Episode>('episodes/', data);
  }

  async getEpisode(episodeId: string): Promise<EpisodeWithScenes> {
    return this.get<EpisodeWithScenes>(`episodes/${episodeId}`);
  }

  async deleteEpisode(episodeId: string): Promise<void> {
    return this.delete<void>(`episodes/${episodeId}`);
  }

  async mockProduceScene(
    episodeId: string,
    sceneId: string
  ): Promise<{
    job_id: string;
    status: string;
    message: string;
  }> {
    return this.post<{
      job_id: string;
      status: string;
      message: string;
    }>(`episodes/${episodeId}/mock-produce-scene/${sceneId}`);
  }

  // ── Seed API ────────────────────────────────────────────────

  async demoSeed(): Promise<SeedResponse> {
    const result = await this.post<{data: SeedResponse} | SeedResponse>('seed');
    return 'data' in result ? result.data : result;
  }

  // ── Workspace API ───────────────────────────────────────────

  async getWorkspaceOverview(): Promise<WorkspaceOverview> {
    return this.get<WorkspaceOverview>('workspace/overview');
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
