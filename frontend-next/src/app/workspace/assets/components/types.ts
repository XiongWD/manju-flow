import type { Asset } from "@/lib/api-client";

// ── Asset type configuration ────────────────────────────────

export const ASSET_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  character_ref: { label: "角色参考", color: "#7C3AED" },
  scene_bg: { label: "场景背景", color: "#0891B2" },
  image: { label: "图像", color: "#7C3AED" },
  video: { label: "视频", color: "#F59E0B" },
  audio: { label: "音频", color: "#22C55E" },
  mixed_audio: { label: "混音", color: "#06B6D4" },
  qa_evidence: { label: "QA 证据", color: "#EF4444" },
  subtitle: { label: "字幕", color: "#767D88" },
  cover: { label: "封面", color: "#F472B6" },
  rules_report: { label: "规则报告", color: "#F97316" },
};

export const OWNER_TYPE_OPTIONS = [
  { value: "", label: "全部" },
  { value: "scene_version", label: "场景版本" },
  { value: "qa_evidence", label: "QA 证据" },
  { value: "character", label: "角色" },
  { value: "project", label: "项目" },
  { value: "episode", label: "剧集" },
];

// ── Helpers ─────────────────────────────────────────────────

export function formatFileSize(bytes?: number): string {
  if (!bytes) return "未知";
  const kb = bytes / 1024;
  const mb = kb / 1024;
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  return `${kb.toFixed(2)} KB`;
}

export function getAssetTypeLabel(type: string): string {
  return ASSET_TYPE_CONFIG[type]?.label ?? type;
}

export function getAssetTypeColor(type: string): string {
  return ASSET_TYPE_CONFIG[type]?.color ?? "#767D88";
}

export function inferAssetType(mimeType?: string, filenameOrUri?: string, assetType?: string): string {
  if (mimeType) {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "audio";
    if (mimeType.includes("pdf")) return "document";
    if (mimeType.includes("document") || mimeType.includes("sheet") || mimeType.startsWith("text/")) return "document";
  }
  const lower = (filenameOrUri || "").toLowerCase();
  if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".gif") || lower.endsWith(".webp")) return "image";
  if (lower.endsWith(".mp4") || lower.endsWith(".mov") || lower.endsWith(".webm")) return "video";
  if (lower.endsWith(".mp3") || lower.endsWith(".wav") || lower.endsWith(".m4a") || lower.endsWith(".aac")) return "audio";
  if (lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".json")) return "document";
  if (assetType === "image" || assetType === "video" || assetType === "audio" || assetType === "document") return assetType;
  return "other";
}

export function getAssetServeUrl(assetId: string): string {
  const base = typeof window !== "undefined" ? "/api" : "http://localhost:8000/api";
  return `${base}/files/serve/${assetId}`;
}

export function isMockUri(uri?: string | null): boolean {
  if (!uri) return true;
  return uri.startsWith("mock://") || uri.startsWith("file://");
}

export function getAssetDisplayName(asset: Asset): string {
  return (asset.metadata_json?.original_filename as string) || asset.id;
}
