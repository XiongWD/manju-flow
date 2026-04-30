'use client'

import { Suspense, useEffect, useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Cpu, FolderKanban } from 'lucide-react'
import { GlassSurface, GlassButton } from '@/components/ui/primitives'
import { PageHeader } from '@/components/workspace/PageHeader'
import { apiClient } from '@/lib/api-client'
import type { EpisodeWithScenes, Scene, JobDetail, JobStatus } from '@/types'
import { EpisodeSelector } from './EpisodeSelector'
import { TabSwitcher } from './TabSwitcher'
import { SceneQueueTable, EmptyScenes } from './SceneQueueTable'
import { JobDetailPanel } from './JobDetailPanel'
import { JobHistoryTable } from './JobHistoryTable'
import { buildSceneJobsMap } from './helpers'

type StatusFilter = 'all' | JobStatus

export function RenderQueueContent() {
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

  const sceneJobsMap = useMemo(() => buildSceneJobsMap(jobs), [jobs])

  const fetchEpisodes = useCallback(async () => {
    if (!projectId) return
    try {
      const data = await apiClient.listEpisodes({ project_id: projectId, limit: 100 })
      const episodesWithScenes = await Promise.all(
        data.items.map(async (ep) => apiClient.getEpisode(ep.id))
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
      const data = projectId
        ? await apiClient.listJobs({ project_id: projectId })
        : await apiClient.listJobs()
      setJobs(data.items)
    } catch (error) {
      console.error('Failed to load jobs:', error)
    }
  }, [projectId])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchEpisodes(), fetchJobs()])
    setLoading(false)
  }, [fetchEpisodes, fetchJobs])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleProduceScene = async (episodeId: string, sceneId: string) => {
    if (!projectId) return
    setProducing(sceneId)
    try {
      const result = await apiClient.createMockSceneJob(sceneId, projectId)
      await fetchAll()
      setSelectedJob(await apiClient.getJob(result.job_id))
    } catch (error) { console.error('Failed to produce scene:', error) }
    finally { setProducing(null) }
  }

  const handleRetryScene = async (sceneId: string) => {
    if (!projectId) return
    setRetrying(sceneId)
    try {
      const sceneJob = sceneJobsMap[sceneId]
      if (!sceneJob) return
      const result = await apiClient.retryJob(sceneJob.id)
      await fetchAll()
      setSelectedJob(await apiClient.getJob(result.job_id))
    } catch (error) { console.error('Failed to retry scene:', error) }
    finally { setRetrying(null) }
  }

  const handleRetryJob = async (jobId: string) => {
    setRetrying(jobId)
    try {
      const result = await apiClient.retryJob(jobId)
      await fetchAll()
      setSelectedJob(await apiClient.getJob(result.job_id))
    } catch (error) { console.error('Failed to retry job:', error) }
    finally { setRetrying(null) }
  }

  const handleCancelJob = async (jobId: string) => {
    setCancelling(jobId)
    try {
      await apiClient.cancelJob(jobId)
      await fetchAll()
      if (selectedJob?.id === jobId) setSelectedJob(await apiClient.getJob(jobId))
    } catch (error) { console.error('Failed to cancel job:', error) }
    finally { setCancelling(null) }
  }

  const handleSeedDemo = async () => {
    try {
      const result = await apiClient.demoSeed()
      window.location.href = `/workspace/projects/${result.project_id}`
    } catch (error) { console.error('Failed to seed demo data:', error) }
  }

  const handleSelectJob = async (jobId: string) => {
    try {
      setSelectedJob(await apiClient.getJob(jobId))
      setActiveTab('queue')
    } catch (error) { console.error('Failed to load job details:', error) }
  }

  const scenes: Scene[] = currentEpisode?.scenes || []

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 space-y-6">
      <PageHeader
        title="渲染队列"
        description="集中查看场景生成任务、处理进度与重试状态。"
        actions={!projectId ? (
          <GlassButton variant="primary" iconLeft={<FolderKanban className="h-4 w-4" />} onClick={handleSeedDemo}>
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
          <TabSwitcher activeTab={activeTab} onChange={setActiveTab} />

          {activeTab === 'queue' && (
            <div className="space-y-4">
              <EpisodeSelector episodes={episodes} currentEpisodeId={currentEpisode?.id} onSelect={setCurrentEpisode} />
              {currentEpisode && scenes.length > 0 ? (
                <SceneQueueTable
                  scenes={scenes}
                  currentEpisode={currentEpisode}
                  sceneJobsMap={sceneJobsMap}
                  producing={producing}
                  retrying={retrying}
                  cancelling={cancelling}
                  onProduce={handleProduceScene}
                  onRetryScene={handleRetryScene}
                  onCancelJob={handleCancelJob}
                />
              ) : currentEpisode ? (
                <EmptyScenes message="该剧集暂无场景" />
              ) : (
                <EmptyScenes message="该项目暂无剧集，请先创建剧集和场景" />
              )}
              {selectedJob && (
                <JobDetailPanel
                  job={selectedJob}
                  retrying={retrying}
                  cancelling={cancelling}
                  onRetry={handleRetryJob}
                  onCancel={handleCancelJob}
                  onClose={() => setSelectedJob(null)}
                />
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <JobHistoryTable
              jobs={jobs}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              retrying={retrying}
              cancelling={cancelling}
              onRetry={handleRetryJob}
              onCancel={handleCancelJob}
              onSelectJob={handleSelectJob}
              onRefresh={fetchJobs}
            />
          )}
        </>
      )}
    </div>
  )
}
