import axios from 'axios'
import type {
  Episode,
  Scene,
  SceneVersion,
  Job,
  Asset,
  QARun,
  QAIssue,
  Project,
  ProjectCreate,
  ProjectUpdate,
  ApiKey,
  ApiKeyCreate,
  ApiKeyCreated,
  ProgressEvent,
} from '@/types'

// Re-export types for backward compatibility
export type {
  Project,
  ProjectCreate,
  ProjectUpdate,
  ApiKey,
  ApiKeyCreate,
  ApiKeyCreated,
  ProgressEvent,
}

/** axios 实例，自动代理到后端 */
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ── 响应拦截器：统一错误处理 ──
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.detail || err.message || '请求失败'
    console.error('[API Error]', msg)
    return Promise.reject(err)
  },
)

// ── Project API ──

export const projectApi = {
  list: () => api.get<Project[]>('/projects').then((r) => r.data),
  get: (id: string) => api.get<Project>(`/projects/${id}`).then((r) => r.data),
  create: (data: ProjectCreate) => api.post<Project>('/projects/', data).then((r) => r.data),
  update: (id: string, data: ProjectUpdate) => api.patch<Project>(`/projects/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/projects/${id}`).then((r) => r.data),
}

// ── ApiKey API ──

export const apikeyApi = {
  list: () => api.get<ApiKey[]>('/apikeys').then((r) => r.data),
  get: (id: string) => api.get<ApiKey>(`/apikeys/${id}`).then((r) => r.data),
  create: (data: ApiKeyCreate) => api.post<ApiKeyCreated>('/apikeys/', data).then((r) => r.data),
  update: (id: string, data: { name?: string; provider?: string; is_active?: boolean }) =>
    api.patch<ApiKey>(`/apikeys/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/apikeys/${id}`).then((r) => r.data),
}

// ── Episode API ──

export const episodeApi = {
  list: (projectId?: string) =>
    api.get<{ data: Episode[] }>('/episodes', { params: { project_id: projectId } }).then((r) => r.data.data),
  get: (id: string) =>
    api.get<{ data: Episode & { scenes: Scene[] } }>(`/episodes/${id}`).then((r) => r.data.data),
  mockProduceScene: (episodeId: string, sceneId: string) =>
    api.post<{ data: { job_id: string; status: string; message: string } }>(
      `/episodes/${episodeId}/mock-produce-scene/${sceneId}`,
    ).then((r) => r.data.data),
}

// ── Scene API ──

export const sceneApi = {
  list: (episodeId?: string) =>
    api.get<{ data: Scene[] }>('/scenes', { params: { episode_id: episodeId } }).then((r) => r.data.data),
  get: (id: string) => api.get<{ data: Scene }>(`/scenes/${id}`).then((r) => r.data.data),
  versions: (sceneId: string) =>
    api.get<{ data: SceneVersion[] }>(`/scenes/${sceneId}/versions`).then((r) => r.data.data),
  retry: (sceneId: string, projectId: string, episodeId?: string) =>
    api.post<{ data: { job_id: string; status: string; message: string } }>(
      `/scenes/${sceneId}/retry`,
      null,
      { params: { project_id: projectId, episode_id: episodeId } },
    ).then((r) => r.data.data),
}

// ── Job API ──

export const jobApi = {
  list: (params?: { project_id?: string; status?: string; target_id?: string }) =>
    api.get<{ data: Job[] }>('/jobs', { params }).then((r) => r.data.data),
  get: (id: string) => api.get<{ data: Job }>(`/jobs/${id}`).then((r) => r.data.data),
  createMockSceneJob: (sceneId: string, projectId: string) =>
    api.post<{ data: { job_id: string; status: string } }>('/jobs/mock-scene-job', null, {
      params: { scene_id: sceneId, project_id: projectId },
    }).then((r) => r.data.data),
  retry: (jobId: string) =>
    api.post<{ data: { job_id: string; status: string; message: string } }>(`/jobs/${jobId}/retry`).then(
      (r) => r.data.data,
    ),
  cancel: (jobId: string) =>
    api.post<{ data: { job_id: string; status: string; message: string } }>(`/jobs/${jobId}/cancel`).then(
      (r) => r.data.data,
    ),
  getProgress: (jobId: string) =>
    api.get<{ data: ProgressEvent[] }>(`/jobs/${jobId}/progress`).then((r) => r.data.data),
  getLatestProgress: (jobId: string) =>
    api.get<{ data: ProgressEvent }>(`/jobs/${jobId}/latest-progress`).then((r) => r.data.data),
}

// ── Asset API ──

export const assetApi = {
  list: (params?: { project_id?: string; owner_type?: string; owner_id?: string; asset_type?: string }) =>
    api.get<{ data: Asset[] }>('/assets', { params }).then((r) => r.data.data),
  get: (id: string) => api.get<{ data: Asset }>(`/assets/${id}`).then((r) => r.data.data),
}

// ── QA API ──

export const qaApi = {
  listRuns: (params?: { project_id?: string; subject_type?: string; subject_id?: string }) =>
    api.get<{ data: QARun[] }>('/qa/runs', { params }).then((r) => r.data.data),
  getRun: (id: string) => api.get<{ data: QARun }>(`/qa/runs/${id}`).then((r) => r.data.data),
  listIssues: (params?: { project_id?: string; severity?: string }) =>
    api.get<{ data: QAIssue[] }>('/qa/issues', { params }).then((r) => r.data.data),
}

// ── Seed API ──

export const seedApi = {
  demo: () => api.post<{ data: { project_id: string; episode_id: string; message: string } }>('/seed').then((r) => r.data.data),
}

export default api
