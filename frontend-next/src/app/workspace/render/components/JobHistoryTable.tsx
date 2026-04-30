'use client'

import { RefreshCw, RotateCcw, Ban, AlertTriangle, Activity } from 'lucide-react'
import { GlassSurface, GlassButton } from '@/components/ui/primitives'
import type { JobDetail, JobStatus } from '@/types'
import { JOB_STATUS_CONFIG } from './constants'
import { getCurrentStepLabel, getJobProgressPercent } from './helpers'

type StatusFilter = 'all' | JobStatus

interface Props {
  jobs: JobDetail[]
  statusFilter: StatusFilter
  onStatusFilterChange: (f: StatusFilter) => void
  retrying: string | null
  cancelling: string | null
  onRetry: (jobId: string) => void
  onCancel: (jobId: string) => void
  onSelectJob: (jobId: string) => void
  onRefresh: () => void
}

export function JobHistoryTable({
  jobs,
  statusFilter,
  onStatusFilterChange,
  retrying,
  cancelling,
  onRetry,
  onCancel,
  onSelectJob,
  onRefresh,
}: Props) {
  const filteredJobs = statusFilter === 'all' ? jobs : jobs.filter((j) => j.status === statusFilter)

  const jobStats = { queued: 0, running: 0, completed: 0, failed: 0, cancelled: 0, total: jobs.length }
  for (const j of jobs) {
    if (j.status in jobStats) jobStats[j.status as keyof typeof jobStats]++
  }

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <button
            onClick={() => onStatusFilterChange('all')}
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
                onClick={() => onStatusFilterChange(statusFilter === s ? 'all' : s)}
                className={`flex items-center gap-1 text-xs font-medium transition-colors ${statusFilter === s ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                {cfg.label} ({jobStats[s]})
              </button>
            )
          })}
        </div>
        <GlassButton size="sm" variant="ghost" iconLeft={<RefreshCw className="h-3 w-3" />} onClick={onRefresh}>
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
                <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">任务 ID</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">状态</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">当前步骤</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">进度</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">成本</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">创建时间</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">操作</th>
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
                    onClick={() => onSelectJob(job.id)}
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
                            size="sm" variant="ghost"
                            iconLeft={retrying === job.id ? undefined : <RotateCcw className="h-3 w-3" />}
                            loading={retrying === job.id}
                            onClick={() => onRetry(job.id)}
                            className="text-amber-400 hover:text-amber-300"
                          >
                            重跑
                          </GlassButton>
                        )}
                        {canCancel && (
                          <GlassButton
                            size="sm" variant="ghost"
                            iconLeft={cancelling === job.id ? undefined : <Ban className="h-3 w-3" />}
                            loading={cancelling === job.id}
                            onClick={() => onCancel(job.id)}
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
  )
}
