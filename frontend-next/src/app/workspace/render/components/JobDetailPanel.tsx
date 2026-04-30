'use client'

import { RotateCcw, Ban, AlertTriangle } from 'lucide-react'
import { GlassSurface, GlassButton, GlassChip } from '@/components/ui/primitives'
import type { JobDetail } from '@/types'
import { JOB_STATUS_CONFIG, STEP_STATUS_CONFIG, STEP_LABELS } from './constants'
import { getJobProgressPercent } from './helpers'

interface Props {
  job: JobDetail
  retrying: string | null
  cancelling: string | null
  onRetry: (jobId: string) => void
  onCancel: (jobId: string) => void
  onClose: () => void
}

export function JobDetailPanel({ job, retrying, cancelling, onRetry, onCancel, onClose }: Props) {
  if (!job.steps || job.steps.length === 0) return null

  const cfg = JOB_STATUS_CONFIG[job.status]
  const Icon = cfg.icon

  return (
    <GlassSurface variant="card">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-medium text-white">任务详情</h3>
        <GlassChip tone="neutral" className="font-mono text-[10px]">
          {job.id.slice(0, 8)}
        </GlassChip>
        <div className="flex items-center gap-2 ml-auto">
          {(job.status === 'failed' || job.status === 'completed') && (
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
          {(job.status === 'running' || job.status === 'queued') && (
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
          <GlassButton size="sm" variant="ghost" onClick={onClose}>关闭</GlassButton>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-3 mb-4">
        <Icon
          className={`h-4 w-4 ${job.status === 'running' ? 'animate-spin' : ''}`}
          style={{ color: cfg.color }}
        />
        <span className="text-sm font-medium text-white">{cfg.label}</span>
        {job.cost_actual !== null && (
          <span className="text-xs text-zinc-500">${job.cost_actual.toFixed(2)}</span>
        )}
        {job.error_message && (
          <div className="flex items-center gap-1 ml-2">
            <AlertTriangle className="h-3 w-3 text-red-400" />
            <span className="text-xs text-red-400">{job.error_message}</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-zinc-500">总体进度</span>
          <span className="text-[10px] font-mono text-zinc-500">{getJobProgressPercent(job)}%</span>
        </div>
        <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${getJobProgressPercent(job)}%`, backgroundColor: cfg.color }}
          />
        </div>
      </div>

      {/* Step pipeline */}
      <div className="space-y-2">
        {job.steps.map((step, idx) => {
          const sc = STEP_STATUS_CONFIG[step.status] || STEP_STATUS_CONFIG.pending
          const StepIcon = sc.icon
          const isLast = idx === job.steps!.length - 1
          return (
            <div key={step.id} className="flex items-center gap-3">
              <div
                className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${sc.color}20` }}
              >
                <StepIcon
                  className={`h-3.5 w-3.5 ${step.status === 'running' ? 'animate-spin' : ''}`}
                  style={{ color: sc.color }}
                />
              </div>
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
              {!isLast && <div className="h-3 w-px bg-zinc-800 shrink-0" />}
            </div>
          )
        })}
      </div>

      {/* Latest progress message */}
      {job.latest_progress && (
        <div className="mt-3 pt-3 border-t border-zinc-800">
          <span className="text-[10px] text-zinc-500">
            {job.latest_progress.message}
            <span className="ml-2 text-zinc-600">
              {new Date(job.latest_progress.timestamp).toLocaleTimeString('zh-CN')}
            </span>
          </span>
        </div>
      )}
    </GlassSurface>
  )
}
