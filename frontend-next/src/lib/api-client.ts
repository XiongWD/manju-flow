// ============================================================
// ArcLine API Client — type definitions & fetch skeleton
// ============================================================

// ── Unified error class ──────────────────────────────────────

export class ApiErrorClass extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(`API Error ${status}: ${detail}`);
    this.status = status;
    this.detail = detail;
    this.name = "ApiErrorClass";
  }
}

// Use absolute URL for server-side rendering
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  (typeof window === "undefined" ? "http://localhost:8000/api" : "/api");

// ── Base types ──────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
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
  effective_tier?: string;
  tier_source?: string;
}

// ── Audio Config types ───────────────────────────────────────────────

export interface VoiceConfig {
  provider: string;
  voice_id: string;
  params?: {
    stability?: number;
    similarity_boost?: number;
  };
}

export interface BGMConfig {
  provider: string;
  style?: string;
  volume?: number;
  fade_in?: number;
  fade_out?: number;
  loop?: boolean;
}

export interface MixConfig {
  voice_volume?: number;
  bgm_volume?: number;
  sample_rate?: number;
  format?: string;
}

export interface AudioConfig {
  voice: VoiceConfig;
  bgm: BGMConfig;
  mix: MixConfig;
}

export interface EpisodeAudioConfig {
  effective_config: AudioConfig;
  config_sources: {
    project_default?: AudioConfig;
    episode_override?: AudioConfig;
    scene_override?: AudioConfig;
  };
}

export interface EpisodeAudioAssets {
  voice_assets: Asset[];
  bgm_assets: Asset[];
  mixed_audio_assets: Asset[];
}

export interface QAEvidenceAssets {
  evidence_assets: Asset[];
  detection_json_assets: Asset[];
}

export interface Scene {
  id: string;
  episode_id: string;
  scene_no: number;
  title?: string;
  duration?: number;
  status: string;
  locked_version_id?: string;
  character_ids?: string[];
  location_id?: string;
  shot_stage?: string;
  created_at: string;
  updated_at: string;
  latest_version?: SceneVersion;
}

export interface Location {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  visual_style?: string;
  reference_asset_id?: string;
  created_at: string;
  updated_at: string;
}

export interface SceneVersionSummary {
  id: string;
  version_no: number;
  status: string;
  score_snapshot?: Record<string, number>;
  cost_actual?: number;
}

export interface FallbackRecord {
  from_tier: string;
  to_tier: string;
  from_provider: string;
  to_provider: string;
  reason: string;
  trigger_gate: string;
  retry_count: number;
  scene_version_id: string;
  timestamp: string;
}

export interface SceneVersionTreeNode {
  id: string;
  version_no: number;
  parent_version_id?: string;
  status: string;
  prompt_bundle?: Record<string, unknown>;
  model_bundle?: Record<string, unknown>;
  params?: Record<string, unknown>;
  change_reason?: string;
  score_snapshot?: Record<string, number>;
  cost_actual?: number;
  created_at?: string;
  updated_at?: string;
  fallback_records: FallbackRecord[];
}

export interface SceneVersionTreeResponse {
  scene_id: string;
  locked_version_id?: string;
  versions: SceneVersionTreeNode[];
}

export interface FallbackHistoryResponse {
  scene_id: string;
  fallback_records: FallbackRecord[];
}

export interface LockSceneVersionRequest {
  scene_id: string;
  scene_version_id: string;
  force?: boolean;
}

export interface LockSceneVersionResponse {
  scene_id: string;
  locked_version_id: string;
  status: string;
}

// ── 042a: 局部返修 + version diff + locked_version 切换 ──────────

export interface SceneReworkRequest {
  scene_version_id: string;
  change_reason: string;
  project_id: string;
  episode_id?: string;
}

export interface SceneReworkResponse {
  job_id: string;
  scene_version_id?: string;
  parent_version_id: string;
  status: string;
  message: string;
}

export interface VersionFieldDiff {
  field: string;
  label: string;
  value_a: unknown;
  value_b: unknown;
  changed: boolean;
}

export interface VersionDiffResponse {
  scene_id: string;
  version_a: SceneVersionTreeNode;
  version_b: SceneVersionTreeNode;
  diffs: VersionFieldDiff[];
  changed_fields: string[];
}

export interface SwitchLockedVersionRequest {
  scene_version_id: string;
  force?: boolean;
}

export interface SwitchLockedVersionResponse {
  scene_id: string;
  locked_version_id: string;
  previous_locked_version_id?: string;
  status: string;
}

// ── 042b: 字幕编辑 + 音频混音编辑 ──────────

export interface SubtitleCue {
  index: number;
  start_time: number;
  end_time: number;
  text: string;
}

export interface SubtitleEditRequest {
  cues: SubtitleCue[];
}

export interface SubtitleEditResponse {
  scene_id: string;
  scene_version_id: string;
  cues: SubtitleCue[];
  updated: boolean;
}

export interface AudioMixEditRequest {
  voice_volume?: number;
  bgm_volume?: number;
  bgm_fade_in?: number;
  bgm_fade_out?: number;
}

export interface AudioMixEditResponse {
  scene_id: string;
  scene_version_id: string;
  voice_volume: number;
  bgm_volume: number;
  bgm_fade_in: number;
  bgm_fade_out: number;
  updated: boolean;
}

export interface EpisodeWithTierInfo extends Episode {
  effective_tier?: string;
  tier_source?: string;
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
  /** 后端字段为 step_key，对应 step_order 不存在 */
  step_key: string;
  tool_name?: string | null;
  status: string;
  finished_at: string | null;
  input_json?: unknown | null;
  output_json?: unknown | null;
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

export interface RuleExecutionResult {
  rule_id: string;
  platform: string;
  subject_type: string;
  subject_id: string;
  passed: boolean;
  severity: 'BLOCK' | 'FLAG';
  auto_checkable: boolean;
  manual_review_required: boolean;
  evidence?: Record<string, unknown>;
  failure_reason?: string;
  qa_run_id?: string;
  qa_issue_ids?: string[];
}

export interface RulesReportResponse {
  results: RuleExecutionResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    block_count: number;
    flag_count: number;
    manual_review_count: number;
  };
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

export interface StoryBibleCreate {
  project_id: string;
  title?: string;
  summary?: string;
  theme?: string;
  conflict?: string;
  content?: string;
  beat_sheet?: Record<string, unknown>;
}

export interface StoryBibleUpdate {
  title?: string;
  summary?: string;
  theme?: string;
  conflict?: string;
  content?: string;
  beat_sheet?: Record<string, unknown>;
  version?: number;
}

export interface StoryBible {
  id: string;
  project_id: string;
  title?: string;
  summary?: string;
  theme?: string;
  conflict?: string;
  content?: string;
  beat_sheet?: Record<string, unknown>;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CharacterCreate {
  project_id: string;
  name: string;
  role_type?: string;
  description?: string;
  voice_profile?: Record<string, unknown>;
  canonical_asset_id?: string;
  episode_ids?: string[];
}

export interface CharacterUpdate {
  name?: string;
  role_type?: string;
  description?: string;
  voice_profile?: Record<string, unknown>;
  canonical_asset_id?: string;
  episode_ids?: string[];
}

export interface Character {
  id: string;
  project_id: string;
  name: string;
  role_type?: string;
  description?: string;
  voice_profile?: Record<string, unknown>;
  canonical_asset_id?: string;
  episode_ids: string[];
  created_at: string;
  updated_at: string;
}

// ── Still Candidate types ────────────────────────────────────

export interface StillCandidate {
  id: string;
  scene_id: string;
  version: number;
  image_path: string;
  thumbnail_path?: string;
  prompt_used?: string;
  seed?: number;
  status: 'pending' | 'approved' | 'rejected';
  review_note?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

// ── Delivery Package types ─────────────────────────────────────

export interface DeliveryPackage {
  id: string;
  episode_id: string;
  package_type: 'video' | 'audio' | 'subtitle' | 'bundle';
  status: 'building' | 'ready' | 'failed' | 'expired';
  asset_id?: string;
  file_size?: number;
  metadata_json?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DeliveryPackageCreate {
  episode_id: string;
  package_type: 'video' | 'audio' | 'subtitle' | 'bundle';
}

// ── Publish Job types ──────────────────────────────────────────

export interface PublishJob {
  id: string;
  project_id: string;
  episode_id?: string;
  platform: string;
  status: 'queued' | 'publishing' | 'published' | 'failed' | 'cancelled';
  delivery_package_id?: string;
  external_id?: string;
  external_url?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface PublishJobCreate {
  project_id: string;
  episode_id?: string;
  platform: string;
  delivery_package_id?: string;
}

// ── API Client ──────────────────────────────────────────────

// ── Auth types ──────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface UserRead {
  id: string;
  email: string;
  display_name?: string;
  role: 'superadmin' | 'manager' | 'employer' | string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
  workspace_id?: string | null;
  page_permissions?: string[] | null;
}

export interface ManagerRead {
  id: string;
  email: string;
  display_name?: string;
  role: string;
  is_active: boolean;
  workspace_id?: string | null;
  created_at: string;
}

export interface WorkspaceRead {
  id: string;
  name: string;
  owner_id: string;
  max_employers: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MemberRead {
  id: string;
  user_id: string;
  workspace_id: string;
  role: string;
  page_permissions: string[];
  invited_by?: string | null;
  created_at: string;
  email?: string;
  display_name?: string;
}

export interface MemberInvite {
  email: string;
  password: string;
  display_name?: string;
  page_permissions?: string[];
}

// ── Analytics types ─────────────────────────────────────────

export interface AnalyticsSnapshot {
  id: string;
  project_id?: string | null;
  episode_id?: string | null;
  publish_job_id?: string | null;
  platform?: string | null;
  external_post_id?: string | null;
  views?: number | null;
  completion_rate?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  watch_time?: number | null;
  source?: string | null;
  snapshot_at: string;
  created_at: string;
}

export interface EpisodeAnalyticsSummary {
  episode_id: string;
  latest_snapshot?: AnalyticsSnapshot | null;
  aggregation: Record<string, unknown>;
}

// ── API Client ──────────────────────────────────────────────

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private cache = new Map<string, { data: any; timestamp: number }>();
  private defaultCacheTtl = 30_000; // 30s

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    // Restore tokens from localStorage (browser only)
    if (typeof window !== "undefined") {
      this.accessToken = localStorage.getItem("access_token");
      this.refreshToken = localStorage.getItem("refresh_token");
    }
  }

  // ── Auth methods ───────────────────────────────────────────

  async login(email: string, password: string): Promise<TokenResponse> {
    const res = await this.request<TokenResponse>("auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    this.setTokens(res.access_token, res.refresh_token);
    return res;
  }

  async register(email: string, password: string, displayName?: string): Promise<UserRead> {
    const res = await this.request<UserRead>("auth/register", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        display_name: displayName,
      }),
    });
    return res;
  }

  async getMe(): Promise<UserRead> {
    return this.request<UserRead>("auth/me");
  }

  // ── System API (superadmin only) ─────────────────────────

  async systemGetManagers(): Promise<ManagerRead[]> {
    return this.request<ManagerRead[]>("system/managers");
  }

  async systemCreateManager(data: { email: string; password: string; display_name?: string }): Promise<ManagerRead> {
    return this.request<ManagerRead>("system/managers", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async systemUpdateManagerStatus(id: string, is_active: boolean): Promise<ManagerRead> {
    return this.request<ManagerRead>(`system/managers/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ is_active }),
    });
  }

  // ── Workspace member API (manager only) ──────────────────

  async workspaceGetInfo(): Promise<WorkspaceRead> {
    return this.request<WorkspaceRead>("workspaces/me");
  }

  async workspaceGetMembers(): Promise<MemberRead[]> {
    return this.request<MemberRead[]>("workspaces/me/members");
  }

  async workspaceInviteMember(data: MemberInvite): Promise<MemberRead> {
    return this.request<MemberRead>("workspaces/me/members", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async workspaceUpdateMemberPermissions(uid: string, page_permissions: string[]): Promise<MemberRead> {
    return this.request<MemberRead>(`workspaces/me/members/${uid}/permissions`, {
      method: "PATCH",
      body: JSON.stringify({ page_permissions }),
    });
  }

  async workspaceRemoveMember(uid: string): Promise<void> {
    return this.request<void>(`workspaces/me/members/${uid}`, { method: "DELETE" });
  }

  async refreshAccessToken(): Promise<TokenResponse> {
    if (!this.refreshToken) {
      throw { code: "NO_REFRESH_TOKEN", message: "No refresh token available" } as ApiError;
    }
    // The backend /api/auth/refresh takes a raw string query param
    const res = await fetch(`${this.baseUrl.replace(/\/$/, '')}/auth/refresh?refresh_token=${encodeURIComponent(this.refreshToken)}`, {
      method: "POST",
    });
    if (!res.ok) {
      this.clearTokens();
      const error: ApiError = await res.json().catch(() => ({
        code: "REFRESH_FAILED",
        message: `Token refresh failed: ${res.status}`,
      }));
      throw error;
    }
    const data: TokenResponse = await res.json();
    this.setTokens(data.access_token, data.refresh_token);
    return data;
  }

  logout(): void {
    this.clearTokens();
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  private setTokens(access: string, refresh: string): void {
    this.accessToken = access;
    this.refreshToken = refresh;
    if (typeof window !== "undefined") {
      localStorage.setItem("access_token", access);
      localStorage.setItem("refresh_token", refresh);
    }
  }

  private clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
    }
  }

  // ── Cache helpers ────────────────────────────────────────

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.defaultCacheTtl) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clearCache(prefix?: string): void {
    if (prefix) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) this.cache.delete(key);
      }
    } else {
      this.cache.clear();
    }
  }

  // ── Core request with auth + auto-refresh ──────────────────

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const method = (options.method ?? 'GET').toUpperCase();
    const cacheKey = `${method}:${path}`;

    // Return cached result for GET requests
    if (method === 'GET') {
      const cached = this.getCached<T>(cacheKey);
      if (cached !== null) return cached;
    }

    // Invalidate related cache on mutations
    if (method !== 'GET' && method !== 'HEAD') {
      const prefix = `GET:${path.split('?')[0].replace(/\/[^/]*$/, '')}`;
      this.clearCache(prefix);
    }

    const url = `${this.baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) ?? {}),
    };

    // Attach Bearer token if available
    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url, { ...options, headers, redirect: "follow" });

    // Auto-refresh on 401 (once)
    if (response.status === 401 && this.refreshToken) {
      try {
        const newTokens = await this.refreshAccessToken();
        // Retry with new token
        headers["Authorization"] = `Bearer ${newTokens.access_token}`;
        const retryResponse = await fetch(url, { ...options, headers, redirect: "follow" });
        if (!retryResponse.ok) {
          const error: ApiError = await retryResponse.json().catch(() => ({
            code: "UNKNOWN",
            message: `Request failed: ${retryResponse.status}`,
          }));
          throw error;
        }
        if (retryResponse.status === 204) return undefined as T;
        const text = await retryResponse.text();
        if (!text) return undefined as T;
        const result = JSON.parse(text) as T;
        if (method === 'GET') this.setCache(cacheKey, result);
        return result;
      } catch {
        // Refresh failed — clear tokens and throw original 401
        const error: ApiError = await response.json().catch(() => ({
          code: "AUTH_REQUIRED",
          message: `Request failed: 401 and token refresh failed`,
        }));
        throw error;
      }
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({ detail: response.statusText }));
      throw new ApiErrorClass(response.status, body.detail || response.statusText);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    if (!text) {
      return undefined as T;
    }

    const result = JSON.parse(text) as T;
    if (method === 'GET') this.setCache(cacheKey, result);
    return result;
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
    skip?: number;
    limit?: number;
    search?: string;
  }): Promise<PaginatedResponse<Asset>> {
    const query = new URLSearchParams();
    if (params?.project_id) query.set("project_id", params.project_id);
    if (params?.owner_type) query.set("owner_type", params.owner_type);
    if (params?.owner_id) query.set("owner_id", params.owner_id);
    if (params?.asset_type) query.set("asset_type", params.asset_type);
    if (params?.skip) query.set("skip", params.skip.toString());
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.search) query.set("search", params.search);
    return this.get<PaginatedResponse<Asset>>(`assets/?${query.toString()}`);
  }

  async uploadFile(formData: FormData): Promise<UploadResponse> {
    const headers: Record<string, string> = {};
    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }
    const response = await fetch(`${this.baseUrl}/files/upload`, {
      method: "POST",
      headers,
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

  async getSceneVersionTree(sceneId: string): Promise<SceneVersionTreeResponse> {
    return this.get<SceneVersionTreeResponse>(`scenes/${sceneId}/version-tree`);
  }

  async getSceneFallbackHistory(sceneId: string): Promise<FallbackHistoryResponse> {
    return this.get<FallbackHistoryResponse>(`scenes/${sceneId}/fallback-history`);
  }

  // ── Lock Scene Version API ───────────────────────────────────────

  async lockSceneVersion(data: LockSceneVersionRequest): Promise<LockSceneVersionResponse> {
    return this.post<LockSceneVersionResponse>('episodes/lock-scene-version', data);
  }

  // ── 042a: 局部返修 + version diff + locked_version 切换 ──────────

  async reworkSceneVersion(sceneId: string, data: SceneReworkRequest): Promise<SceneReworkResponse> {
    return this.post<SceneReworkResponse>(`scenes/${sceneId}/rework`, data);
  }

  async getSceneVersionDiff(sceneId: string, versionAId: string, versionBId: string): Promise<VersionDiffResponse> {
 const query = new URLSearchParams();
    query.set('version_a_id', versionAId);
    query.set('version_b_id', versionBId);
    return this.get<VersionDiffResponse>(`scenes/${sceneId}/versions/diff?${query.toString()}`);
  }

  async switchLockedVersion(sceneId: string, data: SwitchLockedVersionRequest): Promise<SwitchLockedVersionResponse> {
    return this.post<SwitchLockedVersionResponse>(`scenes/${sceneId}/switch-locked`, data);
  }

  // ── 042b: 字幕编辑 + 音频混音编辑 ──────────

  async getSceneSubtitle(sceneId: string, versionId: string): Promise<SubtitleEditResponse> {
    return this.get<SubtitleEditResponse>(`scenes/${sceneId}/versions/${versionId}/subtitle`);
  }

  async updateSceneSubtitle(sceneId: string, versionId: string, data: SubtitleEditRequest): Promise<SubtitleEditResponse> {
    return this.request<SubtitleEditResponse>(`scenes/${sceneId}/versions/${versionId}/subtitle`, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async getSceneAudioMix(sceneId: string, versionId: string): Promise<AudioMixEditResponse> {
    return this.get<AudioMixEditResponse>(`scenes/${sceneId}/versions/${versionId}/audio-mix`);
  }

  async updateSceneAudioMix(sceneId: string, versionId: string, data: AudioMixEditRequest): Promise<AudioMixEditResponse> {
    return this.request<AudioMixEditResponse>(`scenes/${sceneId}/versions/${versionId}/audio-mix`, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // ── Job API ─────────────────────────────────────────────────

  async getJob(jobId: string): Promise<JobDetail> {
    return this.get<JobDetail>(`jobs/${jobId}`);
  }

  async listJobs(params?: {
    project_id?: string;
    target_id?: string;
    status?: string;
    skip?: number;
    limit?: number;
    search?: string;
  }): Promise<PaginatedResponse<JobDetail>> {
    const query = new URLSearchParams();
    if (params?.project_id) query.set("project_id", params.project_id);
    if (params?.target_id) query.set("target_id", params.target_id);
    if (params?.status) query.set("status", params.status);
    if (params?.skip) query.set("skip", params.skip.toString());
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.search) query.set("search", params.search);
    return this.get<PaginatedResponse<JobDetail>>(`jobs/?${query.toString()}`);
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
    skip?: number;
    limit?: number;
    search?: string;
  }): Promise<PaginatedResponse<Scene>> {
    const query = new URLSearchParams();
    if (params?.episode_id) query.set("episode_id", params.episode_id);
    if (params?.skip) query.set("skip", params.skip.toString());
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.search) query.set("search", params.search);
    return this.get<PaginatedResponse<Scene>>(`scenes/?${query.toString()}`);
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
    character_ids?: string[];
  }): Promise<Scene> {
    return this.request<Scene>(`scenes/${sceneId}`, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async deleteScene(sceneId: string): Promise<void> {
    return this.delete<void>(`scenes/${sceneId}`);
  }

  async listScenesByCharacter(characterId: string): Promise<Scene[]> {
    return this.get<Scene[]>(`scenes/by-character/${characterId}`);
  }

  async reorderScenes(sceneIds: string[]): Promise<Scene[]> {
    return this.post<Scene[]>('scenes/batch/reorder', { scene_ids: sceneIds });
  }

  async batchDeleteScenes(sceneIds: string[]): Promise<{ deleted: string[]; not_found: string[]; count: number }> {
    return this.post<{ deleted: string[]; not_found: string[]; count: number }>('scenes/batch/delete', { scene_ids: sceneIds });
  }

  async batchUpdateSceneStatus(sceneIds: string[], status: string): Promise<Scene[]> {
    return this.post<Scene[]>('scenes/batch/update-status', { scene_ids: sceneIds, status });
  }

  async batchUpdateSceneDuration(sceneIds: string[], mode: 'set' | 'add' | 'multiply', value: number): Promise<Scene[]> {
    return this.post<Scene[]>('scenes/batch/update-duration', { scene_ids: sceneIds, mode, value });
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
    skip?: number;
    limit?: number;
  }): Promise<PaginatedResponse<QARun>> {
    const query = new URLSearchParams();
    if (params?.project_id) query.set("project_id", params.project_id);
    if (params?.subject_type) query.set("subject_type", params.subject_type);
    if (params?.subject_id) query.set("subject_id", params.subject_id);
    if (params?.skip) query.set("skip", params.skip.toString());
    if (params?.limit) query.set("limit", params.limit.toString());
    return this.get<PaginatedResponse<QARun>>(`qa/runs?${query.toString()}`);
  }

  async getQARun(runId: string): Promise<QARunDetail> {
    const result = await this.get<{data: QARunDetail} | QARunDetail>(`qa/runs/${runId}`);
    return "data" in result ? result.data : result;
  }

  async listQAIssues(params?: {
    project_id?: string;
    severity?: string;
    skip?: number;
    limit?: number;
  }): Promise<PaginatedResponse<QAIssue>> {
    const query = new URLSearchParams();
    if (params?.project_id) query.set("project_id", params.project_id);
    if (params?.severity) query.set("severity", params.severity);
    if (params?.skip) query.set("skip", params.skip.toString());
    if (params?.limit) query.set("limit", params.limit.toString());
    return this.get<PaginatedResponse<QAIssue>>(`qa/issues?${query.toString()}`);
  }

  // ── Project API ─────────────────────────────────────────────

  async listProjects(params?: { skip?: number; limit?: number; search?: string }): Promise<PaginatedResponse<Project>> {
    const query = new URLSearchParams();
    if (params?.skip) query.set("skip", params.skip.toString());
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.search) query.set("search", params.search);
    return this.get<PaginatedResponse<Project>>(`projects?${query.toString()}`);
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
    skip?: number;
    limit?: number;
    search?: string;
  }): Promise<PaginatedResponse<Episode>> {
    const query = new URLSearchParams();
    if (params?.project_id) query.set("project_id", params.project_id);
    if (params?.skip) query.set("skip", params.skip.toString());
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.search) query.set("search", params.search);
    return this.get<PaginatedResponse<Episode>>(`episodes/?${query.toString()}`);
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

  // ── Audio Config API ───────────────────────────────────────────────
  // NOTE: 后端未实现以下 3 个端点（episodes.py 无对应路由），
  //       方法保留以避免 TS 编译错误，运行时会 404
  // getEpisodeAudioConfig  → GET /api/episodes/{id}/audio-config
  // getEpisodeAudioAssets  → GET /api/episodes/{id}/audio-assets
  // getEpisodeQAEvidenceAssets → GET /api/episodes/{id}/qa-evidence-assets

  async getEpisodeAudioConfig(episodeId: string): Promise<EpisodeAudioConfig> {
    return this.get<EpisodeAudioConfig>(`episodes/${episodeId}/audio-config`);
  }

  async getEpisodeAudioAssets(episodeId: string): Promise<EpisodeAudioAssets> {
    return this.get<EpisodeAudioAssets>(`episodes/${episodeId}/audio-assets`);
  }

  // ── Rules Report API ──────────────────────────────────────────

  async getEpisodeRulesReport(episodeId: string): Promise<RulesReportResponse> {
    const result = await this.get<{data: RulesReportResponse} | RulesReportResponse>(
      `episodes/${episodeId}/rules-report`
    );
    return "data" in result ? result.data : result;
  }

  async getEpisodeQAEvidenceAssets(episodeId: string): Promise<QAEvidenceAssets> {
    return this.get<QAEvidenceAssets>(`episodes/${episodeId}/qa-evidence-assets`);
  }

  // ── Story Bible API ────────────────────────────────────────

  async listStoryBibles(projectId: string, params?: { skip?: number; limit?: number }): Promise<PaginatedResponse<StoryBible>> {
    const query = new URLSearchParams({ project_id: projectId });
    if (params?.skip) query.set("skip", params.skip.toString());
    if (params?.limit) query.set("limit", params.limit.toString());
    return this.get<PaginatedResponse<StoryBible>>(`story-bibles/?${query.toString()}`);
  }

  async getStoryBible(storyBibleId: string): Promise<StoryBible> {
    return this.get<StoryBible>(`story-bibles/${storyBibleId}`);
  }

  async createStoryBible(data: StoryBibleCreate): Promise<StoryBible> {
    return this.post<StoryBible>('story-bibles/', data);
  }

  async updateStoryBible(storyBibleId: string, data: StoryBibleUpdate): Promise<StoryBible> {
    return this.request<StoryBible>(`story-bibles/${storyBibleId}`, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async deleteStoryBible(storyBibleId: string): Promise<void> {
    return this.delete<void>(`story-bibles/${storyBibleId}`);
  }

  // ── Character API ──────────────────────────────────────────

  async listCharacters(projectId: string, params?: { skip?: number; limit?: number; search?: string }): Promise<PaginatedResponse<Character>> {
    const query = new URLSearchParams({ project_id: projectId });
    if (params?.skip) query.set("skip", params.skip.toString());
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.search) query.set("search", params.search);
    return this.get<PaginatedResponse<Character>>(`characters/?${query.toString()}`);
  }

  async getCharacter(characterId: string): Promise<Character> {
    return this.get<Character>(`characters/${characterId}`);
  }

  async createCharacter(data: CharacterCreate): Promise<Character> {
    return this.post<Character>('characters/', data);
  }

  async updateCharacter(characterId: string, data: CharacterUpdate): Promise<Character> {
    return this.request<Character>(`characters/${characterId}`, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async deleteCharacter(characterId: string): Promise<void> {
    return this.delete<void>(`characters/${characterId}`);
  }

  async listCharactersByEpisode(episodeId: string): Promise<Character[]> {
    return this.get<Character[]>(`characters/by-episode/${episodeId}`);
  }

  // ── Delivery Package API ───────────────────────────────────

  async listDeliveryPackages(params?: {
    episode_id?: string;
    skip?: number;
    limit?: number;
  }): Promise<PaginatedResponse<DeliveryPackage>> {
    const query = new URLSearchParams();
    if (params?.episode_id) query.set('episode_id', params.episode_id);
    if (params?.skip) query.set('skip', params.skip.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    return this.get<PaginatedResponse<DeliveryPackage>>(`publish/delivery-packages/?${query.toString()}`);
  }

  async createDeliveryPackage(data: DeliveryPackageCreate): Promise<DeliveryPackage> {
    return this.post<DeliveryPackage>('publish/delivery-packages/', data);
  }

  async getDeliveryPackage(packageId: string): Promise<DeliveryPackage> {
    return this.get<DeliveryPackage>(`publish/delivery-packages/${packageId}`);
  }

  // ── Publish Job API ────────────────────────────────────────

  async listPublishJobs(params?: {
    project_id?: string;
    episode_id?: string;
    skip?: number;
    limit?: number;
  }): Promise<PaginatedResponse<PublishJob>> {
    const query = new URLSearchParams();
    if (params?.project_id) query.set('project_id', params.project_id);
    if (params?.episode_id) query.set('episode_id', params.episode_id);
    if (params?.skip) query.set('skip', params.skip.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    return this.get<PaginatedResponse<PublishJob>>(`publish/jobs/?${query.toString()}`);
  }

  async createPublishJob(data: PublishJobCreate): Promise<PublishJob> {
    return this.post<PublishJob>('publish/jobs/', data);
  }

  async getPublishJob(jobId: string): Promise<PublishJob> {
    return this.get<PublishJob>(`publish/jobs/${jobId}`);
  }

  // ── Still Candidate API ─────────────────────────────────────

  async listStillCandidates(sceneId: string): Promise<StillCandidate[]> {
    return this.get<StillCandidate[]>(`scenes/${sceneId}/still-candidates`);
  }

  async getStillCandidate(candidateId: string): Promise<StillCandidate> {
    return this.get<StillCandidate>(`still-candidates/${candidateId}`);
  }

  async updateStillCandidate(candidateId: string, data: { status: string; review_note?: string }): Promise<StillCandidate> {
    return this.put<StillCandidate>(`still-candidates/${candidateId}`, data);
  }

  async lockStill(sceneId: string, candidateId: string): Promise<{ locked_still_id: string }> {
    return this.post<{ locked_still_id: string }>(`scenes/${sceneId}/lock-still`, { candidate_id: candidateId });
  }

  async getLockedStill(sceneId: string): Promise<StillCandidate> {
    return this.get<StillCandidate>(`scenes/${sceneId}/locked-still`);
  }

  // ── Analytics ────────────────────────────────────────────

  async getEpisodeAnalytics(episodeId: string): Promise<EpisodeAnalyticsSummary> {
    return this.get<EpisodeAnalyticsSummary>(`analytics/episodes/${episodeId}`);
  }

  async listAnalyticsSnapshots(params: {
    episode_id?: string;
    platform?: string;
    page?: number;
    page_size?: number;
  }): Promise<PaginatedResponse<AnalyticsSnapshot>> {
    const query = new URLSearchParams();
    if (params.episode_id) query.set('episode_id', params.episode_id);
    if (params.platform) query.set('platform', params.platform);
    if (params.page) query.set('page', String(params.page));
    if (params.page_size) query.set('page_size', String(params.page_size));
    return this.get<PaginatedResponse<AnalyticsSnapshot>>(`analytics/snapshots?${query.toString()}`);
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
