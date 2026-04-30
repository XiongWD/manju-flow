export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function statusTone(
  status: string
): "neutral" | "info" | "success" | "warning" | "danger" {
  if (["completed", "published", "ready"].includes(status)) return "success";
  if (["running", "publishing", "building"].includes(status)) return "info";
  if (["failed", "expired"].includes(status)) return "danger";
  if (["queued", "pending"].includes(status)) return "warning";
  return "neutral";
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    completed: "已完成",
    published: "已发布",
    ready: "就绪",
    running: "进行中",
    publishing: "发布中",
    building: "生成中",
    failed: "失败",
    expired: "已过期",
    queued: "排队中",
    pending: "待处理",
  };
  return map[status] ?? status;
}

export function shortId(id: string): string {
  return `#${id.slice(0, 8)}`;
}
