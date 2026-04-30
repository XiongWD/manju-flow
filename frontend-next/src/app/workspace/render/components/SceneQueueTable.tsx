'use client'

import { Play, RotateCcw, Ban, Activity } from 'lucide-react'
import { GlassSurface, GlassButton } from '@/components/ui/primitives'
import type { Scene, EpisodeWithScenes, JobDetail } from '@/types'
import { JOB_STATUS_CONFIG } from './constants'
import { getCurrentStepLabel, getJobProgressPercent } from './helpers'

interface Props {
  scenes: Scene[]
  currentEpisode: EpisodeWithScenes
  sceneJobsMap: Record<string, JobDetail>
  producing: string | null
  retrying: string | null
  cancelling: string | null
  onProduce: (episodeId: string, sceneId: string) => void
  onRetryScene: (sceneId: string) => void
  onCancelJob: (jobId: string) => void
}

export function SceneQueueTable({
  scenes,
  currentEpisode,
  sceneJobsMap,
  producing,
  retrying,
  cancelling,
  onProduce,
  onRetryScene,
  onCancelJob,
}: Props) {
  return (
    <GlassSurface variant="card" padded={false} className="overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/50">
            <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider w-[60px]">镜头</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">标题</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">任务状态</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider w-[100px]">当前步骤</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider w-[180px]">进度</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider w-[80px]">版本</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider w-[140px]">操作</th>
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
                  <span className="font-mono text-xs text-zinc-400">S{String(scene.scene_no).padStart(2, '0')}</span>
                </td>
                <td className="py-3 px-4 text-sm text-white">{scene.title || `Scene ${scene.scene_no}`}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1.5">
                    <Icon
                      className={`h-3.5 w-3.5 ${jobStatus === 'running' ? 'animate-spin' : ''}`}
                      style={{ color: cfg.color }}
                    />
                    <span className="text-xs font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
                    {sceneJob?.error_message && (
                      <span className="text-[10px] text-red-400/60 truncate max-w-[100px] ml-1" title={sceneJob.error_message}>
                        {sceneJob.error_message}
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 text-xs text-zinc-500 truncate" title={currentStep}>{currentStep}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${pct}%`, backgroundColor: cfg.color, opacity: pct > 0 ? 1 : 0.3 }}
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
                        size="sm" variant="primary"
                        iconLeft={isProducing ? undefined : <Play className="h-3 w-3" />}
                        loading={isProducing}
                        onClick={() => onProduce(currentEpisode.id, scene.id)}
                      >
                        生产
                      </GlassButton>
                    )}
                    {canRetry && (
                      <GlassButton
                        size="sm" variant="ghost"
                        iconLeft={isRetrying ? undefined : <RotateCcw className="h-3 w-3" />}
                        loading={isRetrying}
                        onClick={() => onRetryScene(scene.id)}
                        className="text-amber-400 hover:text-amber-300"
                      >
                        重跑
                      </GlassButton>
                    )}
                    {canCancel && (
                      <GlassButton
                        size="sm" variant="ghost"
                        iconLeft={cancelling === sceneJob!.id ? undefined : <Ban className="h-3 w-3" />}
                        loading={cancelling === sceneJob!.id}
                        onClick={() => onCancelJob(sceneJob!.id)}
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
  )
}

export function EmptyScenes({ message }: { message: string }) {
  return (
    <GlassSurface variant="card">
      <div className="flex flex-col items-center justify-center py-12">
        <Activity className="mb-3 h-8 w-8 text-zinc-600" />
        <p className="text-sm text-zinc-500">{message}</p>
      </div>
    </GlassSurface>
  )
}
