/**
 * Shared utility functions for SceneList and sub-components.
 * Pure functions — no React dependency.
 */

/** Map a scene/version/job status string to a GlassChip tone. */
export function getStatusTone(
  status: string | null | undefined,
): 'neutral' | 'info' | 'success' | 'warning' | 'danger' {
  if (!status) return 'neutral';

  switch (status) {
    // Scene 状态
    case 'DRAFT':
    case 'draft':
      return 'neutral';
    case 'READY':
    case 'ready':
    case 'completed':
      return 'success';

    // SceneVersion 状态
    case 'GENERATING':
    case 'generating':
      return 'warning';
    case 'QA_PASSED':
    case 'qa_passed':
      return 'success';
    case 'LOCKED':
    case 'locked':
      return 'info';
    case 'FAILED':
    case 'failed':
      return 'danger';

    default:
      return 'neutral';
  }
}

/** Map a job status string to a localised Chinese label. */
export function getJobStatusText(status: string | null | undefined): string {
  if (!status) return '未知';

  const statusMap: Record<string, string> = {
    // 小写（后端实际值）
    pending: '等待中',
    running: '执行中',
    completed: '成功',
    failed: '失败',
    cancelled: '已取消',
    timed_out: '超时',
    // 大写兼容（历史数据）
    PENDING: '等待中',
    RUNNING: '执行中',
    SUCCESS: '成功',
    FAILED: '失败',
    CANCELLED: '已取消',
    TIMED_OUT: '超时',
  };

  return statusMap[status] ?? status;
}

/** Format a byte count as a human-readable string. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/** Format an ISO datetime string for display (zh-CN locale). */
export function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return '-';
  try {
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}
