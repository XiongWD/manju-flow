import type { JobDetail } from '@/types'
import { STEP_LABELS } from './constants'

export function getCurrentStepLabel(job: JobDetail): string {
  if (!job.steps || job.steps.length === 0) return '—'
  const current = [...job.steps].reverse().find((s) => s.status === 'running')
  if (current) return STEP_LABELS[current.step_name] || current.step_name
  const last = job.steps[job.steps.length - 1]
  return STEP_LABELS[last.step_name] || last.step_name
}

export function getJobProgressPercent(job: JobDetail): number {
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

export function buildSceneJobsMap(jobs: JobDetail[]): Record<string, JobDetail> {
  const map: Record<string, JobDetail> = {}
  for (const job of jobs) {
    if (job.target_type === 'scene' && job.target_id) {
      if (!map[job.target_id] || (job.created_at && map[job.target_id].created_at && job.created_at > map[job.target_id].created_at!)) {
        map[job.target_id] = job
      }
    }
  }
  return map
}
