import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { toast } from 'sonner'
import { episodeApi, jobApi, projectApi, seedApi } from '@/lib/api'
import type { Episode, Scene, Job, JobStep, JobStatus, StepStatus } from '@/types'

const STEP_LABELS: Record<string, string> = {
  character_assets: '角色资产生成',
  video_generation: '视频生成',
  audio_generation: '音频生成',
  compose: '合成混音',
  qa_check: '质检检查',
}

const JOB_STATUS_CONFIG: Record<JobStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  queued: { label: '排队中', color: '#767D88', icon: Clock },
  pending: { label: '等待中', color: '#767D88', icon: Clock },
  running: { label: '执行中', color: '#F59E0B', icon: Loader2 },
  completed: { label: '已完成', color: '#22C55E', icon: CheckCircle2 },
  failed: { label: '失败', color: '#EF4444', icon: XCircle },
  cancelled: { label: '已取消', color: '#767D88', icon: Ban },
}

const STEP_STATUS_CONFIG: Record<StepStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  queued: { label: '排队中', color: '#767D88', icon: Clock },
  pending: { label: '等待中', color: '#767D88', icon: Clock },
  running: { label: '执行中', color: '#F59E0B', icon: Loader2 },
  completed: { label: '完成', color: '#22C55E', icon: CheckCircle2 },
  failed: { label: '失败', color: '#EF4444', icon: XCircle },
  skipped: { label: '已跳过', color: '#767D88', icon: SkipForward },
}

type StatusFilter = 'all' | JobStatus

export default function RenderQueue() {
  const navigate = useNavigate()
  const { id: projectId } = useParams()
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [producing, setProducing] = useState<string | null>(null)
  const [retrying, setRetrying] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  // ── Per-scene job lookup ──
  const sceneJobsMap = useMemo(() => {
    const map: Record<string, Job> = {}
    for (const job of jobs) {
      if (job.target_type === 'scene' && job.target_id) {
        // Keep the latest job per scene
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
      const data = await episodeApi.list(projectId)
      setEpisodes(data)
      if (data.length > 0 && !currentEpisode) {
        setCurrentEpisode(data[0])
      }
    } catch {
      toast.error('加载剧集失败')
    }
  }, [projectId, currentEpisode])

  const fetchJobs = useCallback(async () => {
    if (!projectId) return
    try {
      const data = await jobApi.list({ project_id: projectId })
      setJobs(data)
    } catch {
      // jobs endpoint might be empty
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

  useEffect(() => {
    if (!currentEpisode) return
    episodeApi.get(currentEpisode.id).then((detail) => {
      setCurrentEpisode(detail)
    }).catch(() => {})
  }, [currentEpisode?.id]) // eslint-disable-line

  const handleProduceScene = async (episodeId: string, sceneId: string) => {
    setProducing(sceneId)
    try {
      const result = await episodeApi.mockProduceScene(episodeId, sceneId)
      toast.success(result.message || 'Mock 生产完成')
      await fetchAll()
      const newJob = await jobApi.get(result.job_id)
      setSelectedJob(newJob)
    } catch {
      toast.error('Mock 生产失败')
    } finally {
      setProducing(null)
    }
  }

  const handleRetryScene = async (sceneId: string) => {
    if (!projectId) return
    setRetrying(sceneId)
    try {
      const result = await jobApi.retry(sceneJobsMap[sceneId]?.id || '')
      toast.success(result.message || '重跑任务已创建')
      await fetchAll()
      const newJob = await jobApi.get(result.job_id)
      setSelectedJob(newJob)
    } catch {
      toast.error('重跑失败')
    } finally {
      setRetrying(null)
    }
  }

  const handleRetryJob = async (jobId: string) => {
    setRetrying(jobId)
    try {
      const result = await jobApi.retry(jobId)
      toast.success(result.message || '重跑任务已创建')
      await fetchAll()
      const newJob = await jobApi.get(result.job_id)
      setSelectedJob(newJob)
    } catch {
      toast.error('重跑失败')
    } finally {
      setRetrying(null)
    }
  }

  const handleCancelJob = async (jobId: string) => {
    setCancelling(jobId)
    try {
      const result = await jobApi.cancel(jobId)
      toast.success(result.message || '任务已取消')
      await fetchAll()
      if (selectedJob?.id === jobId) {
        const updated = await jobApi.get(jobId)
        setSelectedJob(updated)
      }
    } catch {
      toast.error('取消失败')
    } finally {
      setCancelling(null)
    }
  }

  const handleSeedDemo = async () => {
    try {
      const result = await seedApi.demo()
      toast.success(result.message)
      navigate(`/projects/${result.project_id}`)
    } catch {
      toast.error('生成演示数据失败')
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
  const getCurrentStepLabel = (job: Job): string => {
    if (!job.steps || job.steps.length === 0) return '—'
    const current = [...job.steps].reverse().find((s) => s.status === 'running')
    if (current) return STEP_LABELS[current.step_key] || current.step_key
    const last = job.steps[job.steps.length - 1]
    return STEP_LABELS[last.step_key] || last.step_key
  }

  // ── Helper: get progress percent from latest step ──
  const getJobProgressPercent = (job: Job): number => {
    if (job.progress?.progress_percent !== undefined) return job.progress.progress_percent
    if (!job.steps || job.steps.length === 0) return 0
    const total = job.steps.length
    const completed = job.steps.filter((s) => s.status === 'completed').length
    const failed = job.steps.filter((s) => s.status === 'failed').length
    if (failed > 0 && job.status === 'failed') {
      // Progress at the point of failure
      const firstFailedIdx = job.steps.findIndex((s) => s.status === 'failed')
      return Math.round((firstFailedIdx / total) * 100)
    }
    return Math.round((completed / total) * 100)
  }

  return (
    <div className="space-y-8">
      {/* ── 页面标题 ── */}
      <div className="animate-in">
        <div className="section-kicker mb-3">Production Pipeline</div>
        <div className="flex items-end justify-between">
          <h1 className="display-page text-white">渲染队列</h1>
          {!projectId && (
            <Button onClick={handleSeedDemo} className="bg-primary text-white rounded-lg px-6 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors duration-200">
              <FolderKanban className="mr-2 h-4 w-4" />
              生成演示数据
            </Button>
          )}
        </div>
      </div>

      {!projectId ? (
        <Card className="border-white/[0.06] bg-[#141416]">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Cpu className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <h3 className="text-lg font-semibold text-white">请先选择项目</h3>
            <p className="mt-2 text-sm text-[#767D88] max-w-md text-center">
              从项目列表进入，或点击上方按钮生成演示数据。
            </p>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      ) : (
        <Tabs defaultValue="queue" className="space-y-6">
          <TabsList className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-1 h-auto">
            <TabsTrigger value="queue" className="rounded-md px-4 py-2 text-sm data-[state=active]:bg-white/[0.08] data-[state=active]:text-white text-[#767D88]">
              场景生产队列
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-md px-4 py-2 text-sm data-[state=active]:bg-white/[0.08] data-[state=active]:text-white text-[#767D88]">
              任务历史
            </TabsTrigger>
          </TabsList>

          {/* ── 场景生产队列 ── */}
          <TabsContent value="queue" className="space-y-6 animate-in">
            {/* 剧集选择器 */}
            {episodes.length > 0 && (
              <div className="flex items-center gap-2">
                {episodes.map((ep) => (
                  <button
                    key={ep.id}
                    onClick={() => setCurrentEpisode(ep)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                      currentEpisode?.id === ep.id
                        ? 'bg-white/[0.08] text-white border border-white/[0.1]'
                        : 'bg-white/[0.02] text-[#767D88] border border-transparent hover:text-white/60 hover:bg-white/[0.04]'
                    }`}
                  >
                    第 {ep.episode_no} 集
                    {ep.title ? ` · ${ep.title}` : ''}
                  </button>
                ))}
              </div>
            )}

            {currentEpisode && scenes.length > 0 ? (
              /* 场景列表 — 生产控制台风格 */
              <div className="rounded-lg border border-white/[0.06] bg-[#141416] overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/[0.06] hover:bg-transparent">
                      <TableHead className="text-[#767D88] text-xs font-medium uppercase tracking-wider w-[60px]">镜头</TableHead>
                      <TableHead className="text-[#767D88] text-xs font-medium uppercase tracking-wider">标题</TableHead>
                      <TableHead className="text-[#767D88] text-xs font-medium uppercase tracking-wider">任务状态</TableHead>
                      <TableHead className="text-[#767D88] text-xs font-medium uppercase tracking-wider w-[100px]">当前步骤</TableHead>
                      <TableHead className="text-[#767D88] text-xs font-medium uppercase tracking-wider w-[180px]">进度</TableHead>
                      <TableHead className="text-[#767D88] text-xs font-medium uppercase tracking-wider w-[80px]">版本</TableHead>
                      <TableHead className="text-[#767D88] text-xs font-medium uppercase tracking-wider w-[140px] text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
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
                        <TableRow key={scene.id} className="border-white/[0.04] hover:bg-white/[0.02] group">
                          <TableCell className="font-mono text-xs text-white/60">
                            S{String(scene.scene_no).padStart(2, '0')}
                          </TableCell>
                          <TableCell className="text-sm text-white">{scene.title || `Scene ${scene.scene_no}`}</TableCell>
                          <TableCell>
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
                          </TableCell>
                          <TableCell className="text-xs text-[#767D88] truncate" title={currentStep}>
                            {currentStep}
                          </TableCell>
                          <TableCell>
                            {/* Progress bar */}
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-700 ease-out"
                                  style={{
                                    width: `${pct}%`,
                                    backgroundColor: cfg.color,
                                    opacity: pct > 0 ? 1 : 0.3,
                                  }}
                                />
                              </div>
                              <span className="text-[10px] font-mono text-[#767D88] w-[32px] text-right">{pct}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-[#767D88]">
                            {scene.latest_version ? `v${scene.latest_version.version_no}` : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {!sceneJob && (
                                <Button
                                  size="sm"
                                  disabled={isProducing}
                                  onClick={() => handleProduceScene(currentEpisode.id, scene.id)}
                                  className="bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-200"
                                >
                                  {isProducing ? (
                                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                                  ) : (
                                    <Play className="mr-1.5 h-3 w-3" />
                                  )}
                                  生产
                                </Button>
                              )}
                              {canRetry && (
                                <Button
                                  size="sm"
                                  disabled={isRetrying}
                                  onClick={() => handleRetryScene(scene.id)}
                                  className="bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-200"
                                >
                                  {isRetrying ? (
                                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                                  ) : (
                                    <RotateCcw className="mr-1.5 h-3 w-3" />
                                  )}
                                  重跑
                                </Button>
                              )}
                              {canCancel && (
                                <Button
                                  size="sm"
                                  disabled={cancelling === sceneJob.id}
                                  onClick={() => handleCancelJob(sceneJob.id)}
                                  className="bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-200"
                                >
                                  {cancelling === sceneJob.id ? (
                                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                                  ) : (
                                    <Ban className="mr-1.5 h-3 w-3" />
                                  )}
                                  取消
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : currentEpisode ? (
              <Card className="border-white/[0.06] bg-[#141416]">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Activity className="mb-3 h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-[#767D88]">该剧集暂无场景</p>
                  <p className="text-xs text-[#767D88]/60 mt-1">请在剧本编辑器中添加场景</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-white/[0.06] bg-[#141416]">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Activity className="mb-3 h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-[#767D88]">该项目暂无剧集，请先创建剧集和场景</p>
                </CardContent>
              </Card>
            )}

            {/* ── Job 详情面板 ── */}
            {selectedJob && selectedJob.steps && selectedJob.steps.length > 0 && (
              <div className="animate-in">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-medium text-white">任务详情</h3>
                  <Badge variant="outline" className="font-mono text-[10px]">{selectedJob.id.slice(0, 8)}</Badge>
                  <div className="flex items-center gap-1 ml-auto">
                    {(selectedJob.status === 'failed' || selectedJob.status === 'completed') && (
                      <Button
                        size="sm"
                        disabled={retrying === selectedJob.id}
                        onClick={() => handleRetryJob(selectedJob.id)}
                        className="bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-200"
                      >
                        {retrying === selectedJob.id ? (
                          <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="mr-1.5 h-3 w-3" />
                        )}
                        重跑
                      </Button>
                    )}
                    {(selectedJob.status === 'running' || selectedJob.status === 'queued') && (
                      <Button
                        size="sm"
                        disabled={cancelling === selectedJob.id}
                        onClick={() => handleCancelJob(selectedJob.id)}
                        className="bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-200"
                      >
                        {cancelling === selectedJob.id ? (
                          <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                        ) : (
                          <Ban className="mr-1.5 h-3 w-3" />
                        )}
                        取消
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedJob(null)}
                      className="text-[#767D88] hover:text-white text-xs"
                    >
                      关闭
                    </Button>
                  </div>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-[#141416] p-4">
                  {/* Job 状态头 */}
                  <div className="flex items-center gap-3 mb-4">
                    {(() => {
                      const cfg = JOB_STATUS_CONFIG[selectedJob.status]
                      const Icon = cfg.icon
                      return (
                        <>
                          <Icon className={`h-4 w-4 ${selectedJob.status === 'running' ? 'animate-spin' : ''}`} style={{ color: cfg.color }} />
                          <span className="text-sm font-medium text-white">{cfg.label}</span>
                          {selectedJob.cost_actual && (
                            <span className="meta-ui">${selectedJob.cost_actual.toFixed(2)}</span>
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
                      <span className="text-[10px] text-[#767D88]">总体进度</span>
                      <span className="text-[10px] font-mono text-[#767D88]">{getJobProgressPercent(selectedJob)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
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
                      const sc = STEP_STATUS_CONFIG[step.status] || STEP_STATUS_CONFIG.pending
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
                              <span className="text-xs font-medium text-white">{STEP_LABELS[step.step_key] || step.step_key}</span>
                              <span className="text-[10px]" style={{ color: sc.color }}>{sc.label}</span>
                              {step.error_message && (
                                <span className="text-[10px] text-red-400/70 truncate max-w-[200px]" title={step.error_message}>
                                  — {step.error_message}
                                </span>
                              )}
                            </div>
                          </div>
                          {/* 连接线 */}
                          {!isLast && (
                            <div className="h-3 w-px bg-white/[0.06] shrink-0" />
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* 最新进度消息 */}
                  {selectedJob.progress && (
                    <div className="mt-3 pt-3 border-t border-white/[0.04]">
                      <span className="text-[10px] text-[#767D88]">
                        {selectedJob.progress.message}
                        <span className="ml-2 text-[#767D88]/50">
                          {new Date(selectedJob.progress.timestamp).toLocaleTimeString('zh-CN')}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── 任务历史 ── */}
          <TabsContent value="history" className="space-y-4 animate-in">
            {/* Stats bar */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`text-xs font-medium transition-colors ${statusFilter === 'all' ? 'text-white' : 'text-[#767D88] hover:text-white/60'}`}
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
                      className={`flex items-center gap-1 text-xs font-medium transition-colors ${statusFilter === s ? 'text-white' : 'text-[#767D88] hover:text-white/60'}`}
                    >
                      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                      {cfg.label} ({jobStats[s]})
                    </button>
                  )
                })}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchJobs}
                className="text-[#767D88] hover:text-white text-xs"
              >
                <RefreshCw className="mr-1.5 h-3 w-3" />
                刷新
              </Button>
            </div>

            {filteredJobs.length === 0 ? (
              <Card className="border-white/[0.06] bg-[#141416]">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Activity className="mb-3 h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-[#767D88]">
                    {statusFilter === 'all' ? '暂无任务记录' : `无${JOB_STATUS_CONFIG[statusFilter]?.label || statusFilter}的任务`}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="rounded-lg border border-white/[0.06] bg-[#141416] overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/[0.06] hover:bg-transparent">
                      <TableHead className="text-[#767D88] text-xs font-medium uppercase tracking-wider">任务 ID</TableHead>
                      <TableHead className="text-[#767D88] text-xs font-medium uppercase tracking-wider">状态</TableHead>
                      <TableHead className="text-[#767D88] text-xs font-medium uppercase tracking-wider">当前步骤</TableHead>
                      <TableHead className="text-[#767D88] text-xs font-medium uppercase tracking-wider">进度</TableHead>
                      <TableHead className="text-[#767D88] text-xs font-medium uppercase tracking-wider">成本</TableHead>
                      <TableHead className="text-[#767D88] text-xs font-medium uppercase tracking-wider">创建时间</TableHead>
                      <TableHead className="text-[#767D88] text-xs font-medium uppercase tracking-wider text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredJobs.map((job) => {
                      const cfg = JOB_STATUS_CONFIG[job.status]
                      const pct = getJobProgressPercent(job)
                      const canRetry = job.status === 'failed' || job.status === 'completed'
                      const canCancel = job.status === 'running' || job.status === 'queued'
                      return (
                        <TableRow
                          key={job.id}
                          className="border-white/[0.04] hover:bg-white/[0.02] cursor-pointer"
                          onClick={() => jobApi.get(job.id).then((j) => setSelectedJob(j)).catch(() => {})}
                        >
                          <TableCell className="font-mono text-xs text-white/60">{job.id.slice(0, 8)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                              <span className="text-sm" style={{ color: cfg.color }}>{cfg.label}</span>
                              {job.error_message && (
                                <span title={job.error_message}><AlertTriangle className="h-3 w-3 text-red-400/50 ml-1" /></span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-[#767D88] truncate max-w-[120px]">
                            {job.steps ? getCurrentStepLabel(job) : '—'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${pct}%`, backgroundColor: cfg.color, opacity: pct > 0 ? 1 : 0.3 }}
                                />
                              </div>
                              <span className="text-[10px] font-mono text-[#767D88]">{pct}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-[#767D88]">
                            {job.cost_actual ? `$${job.cost_actual.toFixed(2)}` : '—'}
                          </TableCell>
                          <TableCell className="text-xs text-[#767D88]">
                            {job.created_at ? new Date(job.created_at).toLocaleString('zh-CN') : '—'}
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              {canRetry && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={retrying === job.id}
                                  onClick={() => handleRetryJob(job.id)}
                                  className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 text-xs px-2"
                                >
                                  {retrying === job.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <RotateCcw className="h-3 w-3" />
                                  )}
                                </Button>
                              )}
                              {canCancel && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={cancelling === job.id}
                                  onClick={() => handleCancelJob(job.id)}
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs px-2"
                                >
                                  {cancelling === job.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Ban className="h-3 w-3" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
