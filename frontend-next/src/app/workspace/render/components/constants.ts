import type { StepStatus } from '@/types'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Ban,
  SkipForward,
} from 'lucide-react'

export const STEP_LABELS: Record<string, string> = {
  character_assets: '角色资产生成',
  video_generation: '视频生成',
  audio_generation: '音频生成',
  compose: '合成混音',
  qa_check: '质检检查',
}

export const JOB_STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  queued: { label: '排队中', color: '#767D88', icon: Clock },
  pending: { label: '等待中', color: '#767D88', icon: Clock },
  running: { label: '执行中', color: '#F59E0B', icon: Loader2 },
  completed: { label: '已完成', color: '#22C55E', icon: CheckCircle2 },
  failed: { label: '失败', color: '#EF4444', icon: XCircle },
  cancelled: { label: '已取消', color: '#767D88', icon: Ban },
}

export const STEP_STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  queued: { label: '排队中', color: '#767D88', icon: Clock },
  pending: { label: '等待中', color: '#767D88', icon: Clock },
  running: { label: '执行中', color: '#F59E0B', icon: Loader2 },
  completed: { label: '完成', color: '#22C55E', icon: CheckCircle2 },
  failed: { label: '失败', color: '#EF4444', icon: XCircle },
  skipped: { label: '已跳过', color: '#767D88', icon: SkipForward },
}

export type StatusFilter = 'all' | 'job_status' // re-exported; JobStatus used directly
