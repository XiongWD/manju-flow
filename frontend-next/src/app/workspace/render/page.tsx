'use client'

import { Suspense, useEffect, useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Play,
  RefreshCw,
  ChevronRight,
  Cpu,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  FolderKanban,
  RotateCcw,
  Ban,
  SkipForward,
  AlertTriangle,
  Activity,
} from 'lucide-react'
import { GlassSurface, GlassButton, GlassChip } from '@/components/ui/primitives'
import { PageHeader } from '@/components/workspace/PageHeader'
import { apiClient } from '@/lib/api-client'
import type {
  Episode,
  EpisodeWithScenes,
  Scene,
  JobDetail,
  JobStep,
  JobProgress,
  JobStatus,
  StepStatus,
} from '@/types'

const STEP_LABELS: Record<string, string> = {
  character_assets: '角色资产生成',
  video_generation: '视频生成',
  audio_generation: '音频生成',
  compose: '合成混音',
  qa_check: '质检检查',
}

const JOB_STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  queued: { label: '排队中', color: '#767D88', icon: Clock },
  pending: { label: '等待中', color: '#767D88', icon: Clock },
  running: { label: '执行中', color: '#F59E0B', icon: Loader2 },
  completed: { label: '已完成', color: '#22C55E', icon: CheckCircle2 },
  failed: { label: '失败', color: '#EF4444', icon: XCircle },
  cancelled: { label: '已取消', color: '#767D88', icon: Ban },
}

const STEP_STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  queued: { label: '排队中', color: '#767D88', icon: Clock },
  pending: { label: '等待中', color: '#767D88', icon: Clock },
  running: { label: '执行中', color: '#F59E0B', icon: Loader2 },
  completed: { label: '完成', color: '#22C55E', icon: CheckCircle2 },
  failed: { label: '失败', color: '#EF4444', icon: XCircle },
  skipped: { label: '已跳过', color: '#767D88', icon: SkipForward },
}

type StatusFilter = 'all' | JobStatus

function RenderQueueContent() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project_id')
  const [episodes, setEpisodes] = useState<EpisodeWithScenes[]>([])
  const [currentEpisode, setCurrentEpisode] = useState<EpisodeWithScenes | null>(null)
  const [jobs, setJobs] = useState<JobDetail[]>([])
  const [selectedJob, setSelectedJob] = useState<JobDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [producing, setProducing] = useState<string | null>(null)
  const [retrying, setRetrying] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue')

  // ── Per-scene job lookup ──
  const sceneJobsMap = useMemo(() => {
    const map: Record<string, JobDetail> = {}
    for (const job of jobs) {
      if (job.target_type === 'scene' && job.target_id) {
        if (!map[job.target_id] || (job.created_at && map[job.target_id].created_at && job.created_at > map[job.target_id].created_at!)) {
          map[job.target_id] = job
        }
      }
    }
    return map
  }, [jobs])

  const fetchEpisodes = useCallback(async () => {
    if (!projectId) return
    try {
      const data = await apiClient.listEpisodes({ project_id: projectId, limit: 100 })
      // Fetch scenes for each episode
      const episodesWithScenes = await Promise.all(
        data.map(async (ep) => {
          const detail = await apiClient.getEpisode(ep.id)
          return detail
        })
      )
      setEpisodes(episodesWithScenes)
      if (episodesWithScenes.length > 0 && !currentEpisode) {
        setCurrentEpisode(episodesWithScenes[0])
      }
    } catch (error) {
      console.error('Failed to load episodes:', error)
    }
  }, [projectId, currentEpisode])

  const fetchJobs = useCallback(async () => {
    try {
      if (projectId) {
        const data = await apiClient.listJobs({ project_id: projectId })
        setJobs(data)
      } else {
        // Fetch all jobs when no project filter
        const data = await apiClient.listJobs()
        setJobs(data)
      }
    } catch (error) {
      console.error('Failed to load jobs:', error)
    }
  }, [projectId])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchEpisodes(), fetchJobs()])
    setLoading(false)
  }, [fetchEpisodes, fetchJobs])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const handleProduceScene = async (episodeId: string, sceneId: string) => {
    if (!projectId) return
    setProducing(sceneId)
    try {
      const result = await apiClient.createMockSceneJob(sceneId, projectId)
      await fetchAll()
      const newJob = await apiClient.getJob(result.job_id)
      setSelectedJob(newJob)
    } catch (error) {
      console.error('Failed to produce scene:', error)
    } finally {
      setProducing(null)
    }
  }

  const handleRetryScene = async (sceneId: string) => {
    if (!projectId) return
    setRetrying(sceneId)
    try {
      const sceneJob = sceneJobsMap[sceneId]
      if (!sceneJob) return
      const result = await apiClient.retryJob(sceneJob.id)
      await fetchAll()
      const newJob = await apiClient.getJob(result.job_id)
      setSelectedJob(newJob)
    } catch (error) {
      console.error('Failed to retry scene:', error)
    } finally {
      setRetrying(null)
    }
  }

  const handleRetryJob = async (jobId: string) => {
    setRetrying(jobId)
    try {
      const result = await apiClient.retryJob(jobId)
      await fetchAll()
      const newJob = await apiClient.getJob(result.job_id)
      setSelectedJob(newJob)
    } catch (error) {
      console.error('Failed to retry job:', error)
    } finally {
      setRetrying(null)
    }
  }

  const handleCancelJob = async (jobId: string) => {
    setCancelling(jobId)
    try {
      await apiClient.cancelJob(jobId)
      await fetchAll()
      if (selectedJob?.id === jobId) {
        const updated = await apiClient.getJob(jobId)
        setSelectedJob(updated)
      }
    } catch (error) {
      console.error('Failed to cancel job:', error)
    } finally {
      setCancelling(null)
    }
  }

  const handleSeedDemo = async () => {
    try {
      const result = await apiClient.demoSeed()
      window.location.href = `/workspace/projects/${result.project_id}`
    } catch (error) {
      console.error('Failed to seed demo data:', error)
    }
  }

  const handleSelectJob = async (jobId: string) => {
    try {
      const job = await apiClient.getJob(jobId)
      setSelectedJob(job)
      setActiveTab('queue')
    } catch (error) {
      console.error('Failed to load job details:', error)
    }
  }

  const scenes: Scene[] = currentEpisode?.scenes || []

  // ── Filtered jobs for history tab ──
  const filteredJobs = useMemo(() => {
    if (statusFilter === 'all') return jobs
    return jobs.filter((j) => j.status === statusFilter)
  }, [jobs, statusFilter])

  // ── Job stats ──
  const jobStats = useMemo(() => {
    const stats = { queued: 0, running: 0, completed: 0, failed: 0, cancelled: 0, total: jobs.length }
    for (const j of jobs) {
      if (j.status in stats) stats[j.status as keyof typeof stats]++
    }
    return stats
  }, [jobs])

  // ── Helper: get current step label for a job ──
  const getCurrentStepLabel = (job: JobDetail): string => {
    if (!job.steps || job.steps.length === 0) return '—'
    const current = [...job.steps].reverse().find((s) => s.status === 'running')
    if (current) return STEP_LABELS[current.step_name] || current.step_name
    const last = job.steps[job.steps.length - 1]
    return STEP_LABELS[last.step_name] || last.step_name
  }

  // ── Helper: get progress percent from job ──
  const getJobProgressPercent = (job: JobDetail): number => {
    if (!job.steps || job.steps.length === 0) return 0
    const total = job.steps.length
    const completed = job.steps.filter((s) => s.status === 'completed').length
    const failed = job.steps.filter((s) => s.status === 'failed').length
    if (failed > 0 && job.status === 'failed') {
      const firstFailedIdx = job.steps.findIndex((s) => s.status === 'failed')
      return Math.round((firstFailedIdx / total) * 100)
    }
    return Math.round((completed / total) * 100)
  }

  return (
    <div className="p-6 md:p-8 space-y-12">
      <PageHeader
        title="渲染队列"
        description="集中查看场景生成任务、处理进度与重试状态。"
        actions={!projectId ? (
          <GlassButton
            variant="primary"
            iconLeft={<FolderKanban className="h-4 w-4" />}
            onClick={handleSeedDemo}
          >
            生成演示数据
          </GlassButton>
        ) : undefined}
      />

      {!projectId ? (
        <GlassSurface variant="card" interactive={false}>
          <div className="flex flex-col items-center justify-center py-16">
            <Cpu className="mb-4 h-12 w-12 text-zinc-600" />
            <h3 className="text-lg font-semibold text-white mb-2">请先选择项目</h3>
            <p className="text-sm text-zinc-500 text-center max-w-md">
              从<Link href="/workspace/projects" className="text-blue-400 hover:underline">项目列表</Link>进入，或点击上方按钮生成演示数据。
            </p>
          </div>
        </GlassSurface>
      ) : loading ? (
        <GlassSurface variant="card">
          <div className="space-y-3">
            <div className="h-12 w-full bg-zinc-800 rounded animate-pulse" />
            <div className="h-32 w-full bg-zinc-800 rounded animate-pulse" />
          </div>
        </GlassSurface>
      ) : (
        <>
          {/* ── Tab 切换 ── */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('queue')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'queue'
                  ? 'bg-zinc-800 text-white border border-zinc-700'
                  : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              场景生产队列
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'history'
                  ? 'bg-zinc-800 text-white border border-zinc-700'
                  : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              任务历史
            </button>
          </div>

          {/* ── 场景生产队列 ── */}
          {activeTab === 'queue' && (
            <div className="space-y-4">
              {/* 剧集选择器 */}
              {episodes.length > 0 && (
                <div className="flex items-center gap-2">
                  {episodes.map((ep) => (
                    <button
                      key={ep.id}
                      onClick={() => setCurrentEpisode(ep)}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        currentEpisode?.id === ep.id
                          ? 'bg-zinc-800 text-white border border-zinc-700'
                          : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      第 {ep.episode_no} 集
                      {ep.title ? ` · ${ep.title}` : ''}
                    </button>
                  ))}
                </div>
              )}

              {currentEpisode && scenes.length > 0 ? (
                /* 场景列表 */
                <GlassSurface variant="card" padded={false} className="overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/50">
                        <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider w-[60px]">
                          镜头
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                          标题
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                          任务状态
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider w-[100px]">
                          当前步骤
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider w-[180px]">
                          进度
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider w-[80px]">
                          版本
                        </th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider w-[140px]">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {scenes.map((scene) => {
                        const sceneJob = sceneJobsMap[scene.id]
                        const jobStatus = sceneJob?.status || 'pending'
                        const cfg = JOB_STATUS_CONFIG[jobStatus] || JOB_STATUS_CONFIG.pending
                        const Icon = cfg.icon
                        const pct = sceneJob ? getJobProgressPercent(sceneJob) : 0
                        const currentStep = sceneJob ? getCurrentStepLabel(sceneJob) : '—'
                        const canRetry = sceneJob && (sceneJob.status === 'failed' || sceneJob.status === 'completed')
                        const canCancel = sceneJob && (sceneJob.status === 'running' || sceneJob.status === 'queued')
                        const isProducing = producing === scene.id
                        const isRetrying = retrying === scene.id

                        return (
                          <tr key={scene.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                            <td className="py-3 px-4">
                              <span className="font-mono text-xs text-zinc-400">
                                S{String(scene.scene_no).padStart(2, '0')}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-sm text-white">{scene.title || `Scene ${scene.scene_no}`}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5">
                                <Icon
                                  className={`h-3.5 w-3.5 ${jobStatus === 'running' ? 'animate-spin' : ''}`}
                                  style={{ color: cfg.color }}
                                />
                                <span className="text-xs font-medium" style={{ color: cfg.color }}>
                                  {cfg.label}
                                </span>
                                {sceneJob?.error_message && (
                                  <span className="text-[10px] text-red-400/60 truncate max-w-[100px] ml-1" title={sceneJob.error_message}>
                                    {sceneJob.error_message}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-xs text-zinc-500 truncate" title={currentStep}>
                              {currentStep}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-700 ease-out"
                                    style={{
                                      width: `${pct}%`,
                                      backgroundColor: cfg.color,
                                      opacity: pct > 0 ? 1 : 0.3,
                                    }}
                                  />
                                </div>
                                <span className="text-[10px] font-mono text-zinc-500 w-[32px] text-right">{pct}%</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm text-zinc-500">
                              {scene.latest_version ? `v${scene.latest_version.version_no}` : '—'}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {!sceneJob && (
                                  <GlassButton
                                    size="sm"
                                    variant="primary"
                                    iconLeft={isProducing ? undefined : <Play className="h-3 w-3" />}
                                    loading={isProducing}
                                    onClick={() => handleProduceScene(currentEpisode!.id, scene.id)}
                                  >
                                    生产
                                  </GlassButton>
                                )}
                                {canRetry && (
                                  <GlassButton
                                    size="sm"
                                    variant="ghost"
                                    iconLeft={isRetrying ? undefined : <RotateCcw className="h-3 w-3" />}
                                    loading={isRetrying}
                                    onClick={() => handleRetryScene(scene.id)}
                                    className="text-amber-400 hover:text-amber-300"
                                  >
                                    重跑
                                  </GlassButton>
                                )}
                                {canCancel && (
                                  <GlassButton
                                    size="sm"
                                    variant="ghost"
                                    iconLeft={cancelling === sceneJob!.id ? undefined : <Ban className="h-3 w-3" />}
                                    loading={cancelling === sceneJob!.id}
                                    onClick={() => handleCancelJob(sceneJob!.id)}
                                    className="text-red-400 hover:text-red-300"
                                  >
                                    取消
                                  </GlassButton>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </GlassSurface>
              ) : currentEpisode ? (
                <GlassSurface variant="card">
                  <div className="flex flex-col items-center justify-center py-12">
                    <Activity className="mb-3 h-8 w-8 text-zinc-600" />
                    <p className="text-sm text-zinc-500">该剧集暂无场景</p>
                    <p className="text-xs text-zinc-600 mt-1">请在剧本编辑器中添加场景</p>
                  </div>
                </GlassSurface>
              ) : (
                <GlassSurface variant="card">
                  <div className="flex flex-col items-center justify-center py-12">
                    <Activity className="mb-3 h-8 w-8 text-zinc-600" />
                    <p className="text-sm text-zinc-500">该项目暂无剧集，请先创建剧集和场景</p>
                  </div>
                </GlassSurface>
              )}

              {/* ── Job 详情面板 ── */}
              {selectedJob && selectedJob.steps && selectedJob.steps.length > 0 && (
                <GlassSurface variant="card">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-sm font-medium text-white">任务详情</h3>
                    <GlassChip tone="neutral" className="font-mono text-[10px]">
                      {selectedJob.id.slice(0, 8)}
                    </GlassChip>
                    <div className="flex items-center gap-2 ml-auto">
                      {(selectedJob.status === 'failed' || selectedJob.status === 'completed') && (
                        <GlassButton
                          size="sm"
                          variant="ghost"
                          iconLeft={retrying === selectedJob.id ? undefined : <RotateCcw className="h-3 w-3" />}
                          loading={retrying === selectedJob.id}
                          onClick={() => handleRetryJob(selectedJob.id)}
                          className="text-amber-400 hover:text-amber-300"
                        >
                          重跑
                        </GlassButton>
                      )}
                      {(selectedJob.status === 'running' || selectedJob.status === 'queued') && (
                        <GlassButton
                          size="sm"
                          variant="ghost"
                          iconLeft={cancelling === selectedJob.id ? undefined : <Ban className="h-3 w-3" />}
                          loading={cancelling === selectedJob.id}
                          onClick={() => handleCancelJob(selectedJob.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          取消
                        </GlassButton>
                      )}
                      <GlassButton
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedJob(null)}
                      >
                        关闭
                      </GlassButton>
                    </div>
                  </div>

                  {/* Job 状态头 */}
                  <div className="flex items-center gap-3 mb-4">
                    {(() => {
                      const cfg = JOB_STATUS_CONFIG[selectedJob.status]
                      const Icon = cfg.icon
                      return (
                        <>
                          <Icon
                            className={`h-4 w-4 ${selectedJob.status === 'running' ? 'animate-spin' : ''}`}
                            style={{ color: cfg.color }}
                          />
                          <span className="text-sm font-medium text-white">{cfg.label}</span>
                          {selectedJob.cost_actual !== null && (
                            <span className="text-xs text-zinc-500">${selectedJob.cost_actual.toFixed(2)}</span>
                          )}
                          {selectedJob.error_message && (
                            <div className="flex items-center gap-1 ml-2">
                              <AlertTriangle className="h-3 w-3 text-red-400" />
                              <span className="text-xs text-red-400">{selectedJob.error_message}</span>
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </div>

                  {/* 进度条 */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-zinc-500">总体进度</span>
                      <span className="text-[10px] font-mono text-zinc-500">{getJobProgressPercent(selectedJob)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${getJobProgressPercent(selectedJob)}%`,
                          backgroundColor: JOB_STATUS_CONFIG[selectedJob.status].color,
                        }}
                      />
                    </div>
                  </div>

                  {/* 步骤流水线可视化 */}
                  <div className="space-y-2">
                    {selectedJob.steps.map((step: JobStep, idx: number) => {
                      const sc = STEP_STATUS_CONFIG[step.status as StepStatus] || STEP_STATUS_CONFIG.pending
                      const StepIcon = sc.icon
                      const isLast = idx === selectedJob.steps!.length - 1
                      return (
                        <div key={step.id} className="flex items-center gap-3">
                          {/* 步骤状态图标 */}
                          <div
                            className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${sc.color}20` }}
                          >
                            <StepIcon
                              className={`h-3.5 w-3.5 ${step.status === 'running' ? 'animate-spin' : ''}`}
                              style={{ color: sc.color }}
                            />
                          </div>
                          {/* 步骤信息 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-white">{STEP_LABELS[step.step_name] || step.step_name}</span>
                              <span className="text-[10px]" style={{ color: sc.color }}>{sc.label}</span>
                              {step.error_message && (
                                <span className="text-[10px] text-red-400/70 truncate max-w-[200px]" title={step.error_message}>
                                  — {step.error_message}
                                </span>
                              )}
                            </div>
                          </div>
                          {/* 连接线 */}
                          {!isLast && <div className="h-3 w-px bg-zinc-800 shrink-0" />}
                        </div>
                      )
                    })}
                  </div>

                  {/* 最新进度消息 */}
                  {selectedJob.latest_progress && (
                    <div className="mt-3 pt-3 border-t border-zinc-800">
                      <span className="text-[10px] text-zinc-500">
                        {selectedJob.latest_progress.message}
                        <span className="ml-2 text-zinc-600">
                          {new Date(selectedJob.latest_progress.timestamp).toLocaleTimeString('zh-CN')}
                        </span>
                      </span>
                    </div>
                  )}
                </GlassSurface>
              )}
            </div>
          )}

          {/* ── 任务历史 ── */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {/* Stats bar */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`text-xs font-medium transition-colors ${statusFilter === 'all' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    全部 ({jobStats.total})
                  </button>
                  {(['running', 'completed', 'failed', 'cancelled'] as const).map((s) => {
                    if (jobStats[s] === 0) return null
                    const cfg = JOB_STATUS_CONFIG[s]
                    return (
                      <button
                        key={s}
                        onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
                        className={`flex items-center gap-1 text-xs font-medium transition-colors ${statusFilter === s ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                        {cfg.label} ({jobStats[s]})
                      </button>
                    )
                  })}
                </div>
                <GlassButton
                  size="sm"
                  variant="ghost"
                  iconLeft={<RefreshCw className="h-3 w-3" />}
                  onClick={fetchJobs}
                >
                  刷新
                </GlassButton>
              </div>

              {filteredJobs.length === 0 ? (
                <GlassSurface variant="card">
                  <div className="flex flex-col items-center justify-center py-12">
                    <Activity className="mb-3 h-8 w-8 text-zinc-600" />
                    <p className="text-sm text-zinc-500">
                      {statusFilter === 'all' ? '暂无任务记录' : `无${JOB_STATUS_CONFIG[statusFilter]?.label || statusFilter}的任务`}
                    </p>
                  </div>
                </GlassSurface>
              ) : (
                <GlassSurface variant="card" padded={false} className="overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/50">
                        <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                          任务 ID
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                          状态
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                          当前步骤
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                          进度
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                          成本
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                          创建时间
                        </th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredJobs.map((job) => {
                        const cfg = JOB_STATUS_CONFIG[job.status]
                        const pct = getJobProgressPercent(job)
                        const canRetry = job.status === 'failed' || job.status === 'completed'
                        const canCancel = job.status === 'running' || job.status === 'queued'
                        return (
                          <tr
                            key={job.id}
                            className="border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer transition-colors"
                            onClick={() => handleSelectJob(job.id)}
                          >
                            <td className="py-3 px-4">
                              <span className="font-mono text-xs text-zinc-400">{job.id.slice(0, 8)}</span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5">
                                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                                <span className="text-sm" style={{ color: cfg.color }}>{cfg.label}</span>
                                {job.error_message && (
                                  <span title={job.error_message}>
                                    <AlertTriangle className="h-3 w-3 text-red-400/50 ml-1" />
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-xs text-zinc-500 truncate max-w-[120px]">
                              {job.steps ? getCurrentStepLabel(job) : '—'}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{ width: `${pct}%`, backgroundColor: cfg.color, opacity: pct > 0 ? 1 : 0.3 }}
                                  />
                                </div>
                                <span className="text-[10px] font-mono text-zinc-500">{pct}%</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm text-zinc-500">
                              {job.cost_actual !== null ? `$${job.cost_actual.toFixed(2)}` : '—'}
                            </td>
                            <td className="py-3 px-4 text-xs text-zinc-500">
                              {job.created_at ? new Date(job.created_at).toLocaleString('zh-CN') : '—'}
                            </td>
                            <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1">
                                {canRetry && (
                                  <GlassButton
                                    size="sm"
                                    variant="ghost"
                                    iconLeft={retrying === job.id ? undefined : <RotateCcw className="h-3 w-3" />}
                                    loading={retrying === job.id}
                                    onClick={() => handleRetryJob(job.id)}
                                    className="text-amber-400 hover:text-amber-300"
                                  >
                                    重跑
                                  </GlassButton>
                                )}
                                {canCancel && (
                                  <GlassButton
                                    size="sm"
                                    variant="ghost"
                                    iconLeft={cancelling === job.id ? undefined : <Ban className="h-3 w-3" />}
                                    loading={cancelling === job.id}
                                    onClick={() => handleCancelJob(job.id)}
                                    className="text-red-400 hover:text-red-300"
                                  >
                                    取消
                                  </GlassButton>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </GlassSurface>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function RenderQueuePage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center text-zinc-400">加载中...</div>}>
      <RenderQueueContent />
    </Suspense>
  )
}
