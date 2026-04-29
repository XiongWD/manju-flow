"use client";

import { Suspense, useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import GlassSurface from "@/components/ui/primitives/GlassSurface";
import GlassModalShell from "@/components/ui/primitives/GlassModalShell";
import GlassInput from "@/components/ui/primitives/GlassInput";
import GlassButton from "@/components/ui/primitives/GlassButton";
import GlassChip from "@/components/ui/primitives/GlassChip";
import GlassField from "@/components/ui/primitives/GlassField";
import { PageHeader } from "@/components/workspace/PageHeader";
import {
  apiClient,
  type Asset,
  type UploadResponse,
  type Episode,
  type Scene,
  type SceneVersion,
} from "@/lib/api-client";

export const dynamic = "force-dynamic";

// ── Asset type configuration ────────────────────────────────

const ASSET_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
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

const OWNER_TYPE_OPTIONS = [
  { value: "", label: "全部" },
  { value: "scene_version", label: "场景版本" },
  { value: "qa_evidence", label: "QA 证据" },
  { value: "character", label: "角色" },
  { value: "project", label: "项目" },
  { value: "episode", label: "剧集" },
];

// ── Helpers ─────────────────────────────────────────────────

function formatFileSize(bytes?: number): string {
  if (!bytes) return "未知";
  const kb = bytes / 1024;
  const mb = kb / 1024;
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  return `${kb.toFixed(2)} KB`;
}

function getAssetTypeLabel(type: string): string {
  return ASSET_TYPE_CONFIG[type]?.label ?? type;
}

function getAssetTypeColor(type: string): string {
  return ASSET_TYPE_CONFIG[type]?.color ?? "#767D88";
}

function inferAssetType(mimeType?: string, filenameOrUri?: string, assetType?: string): string {
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

// ── Page ────────────────────────────────────────────────────

function AssetHubContent() {
  const searchParams = useSearchParams();
  const urlProjectId = searchParams.get("project_id") ?? undefined;

  // ── Core state ──
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [imagePreviewMode, setImagePreviewMode] = useState<"fit" | "full">("fit");
  const [imageZoom, setImageZoom] = useState(100);
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const [draggingImage, setDraggingImage] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const [videoMeta, setVideoMeta] = useState<{ duration?: number; width?: number; height?: number; bitrateKbps?: number }>({});

  // ── Link form ──
  const [linking, setLinking] = useState(false);
  const [linkMessage, setLinkMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [linkAssetId, setLinkAssetId] = useState("");
  const [linkOwnerType, setLinkOwnerType] = useState("");
  const [linkOwnerId, setLinkOwnerId] = useState("");

  // ── Filter state ──
  const [searchQuery, setSearchQuery] = useState("");
  const [assetTypeFilter, setAssetTypeFilter] = useState("all");
  const [ownerTypeFilter, setOwnerTypeFilter] = useState("");
  const [ownerIdInput, setOwnerIdInput] = useState("");
  const [qaEvidenceMode, setQaEvidenceMode] = useState(false);

  // ── Scene Version cascade state ──
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(
    null
  );
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [versions, setVersions] = useState<SceneVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    null
  );
  const [cascadeLoading, setCascadeLoading] = useState(false);

  // ── Fetch cascade: episodes when project selected ──
  const fetchEpisodes = useCallback(async () => {
    if (!urlProjectId) {
      setEpisodes([]);
      setSelectedEpisodeId(null);
      return;
    }
    try {
      setCascadeLoading(true);
      const data = await apiClient.listEpisodes({ project_id: urlProjectId });
      setEpisodes(data);
      // Auto-select first episode if none selected
      if (data.length > 0 && !selectedEpisodeId) {
        setSelectedEpisodeId(data[0].id);
      } else if (data.length === 0) {
        setSelectedEpisodeId(null);
      }
    } catch (e) {
      console.error("加载剧集失败:", e);
    } finally {
      setCascadeLoading(false);
    }
  }, [urlProjectId, selectedEpisodeId]);

  // ── Fetch cascade: scenes when episode selected ──
  const fetchScenes = useCallback(async () => {
    if (!selectedEpisodeId) {
      setScenes([]);
      setSelectedSceneId(null);
      return;
    }
    try {
      setCascadeLoading(true);
      const data = await apiClient.listScenes({
        episode_id: selectedEpisodeId,
      });
      setScenes(data);
      if (data.length > 0 && !selectedSceneId) {
        setSelectedSceneId(data[0].id);
      } else if (data.length === 0) {
        setSelectedSceneId(null);
      }
    } catch (e) {
      console.error("加载场景失败:", e);
    } finally {
      setCascadeLoading(false);
    }
  }, [selectedEpisodeId, selectedSceneId]);

  // ── Fetch cascade: versions when scene selected ──
  const fetchVersions = useCallback(async () => {
    if (!selectedSceneId) {
      setVersions([]);
      setSelectedVersionId(null);
      return;
    }
    try {
      setCascadeLoading(true);
      const data = await apiClient.listSceneVersions(selectedSceneId);
      setVersions(data);
      if (data.length > 0) {
        // Auto-select latest version
        const latest = data[data.length - 1];
        setSelectedVersionId(latest.id);
      } else {
        setSelectedVersionId(null);
      }
    } catch (e) {
      console.error("加载版本失败:", e);
    } finally {
      setCascadeLoading(false);
    }
  }, [selectedSceneId]);

  // ── Fetch assets (main list) ──
  const loadAssets = useCallback(async () => {
    try {
      setLoading(true);
      const params: Parameters<typeof apiClient.listAssets>[0] = {
        limit: 200,
      };
      if (urlProjectId) {
        params.project_id = urlProjectId;
      }
      // If version selected in cascade, use it as owner filter
      if (selectedVersionId) {
        params.owner_type = "scene_version";
        params.owner_id = selectedVersionId;
      } else if (ownerTypeFilter) {
        params.owner_type = ownerTypeFilter;
        if (ownerIdInput.trim()) {
          params.owner_id = ownerIdInput.trim();
        }
      }
      const data = await apiClient.listAssets(params);
      setAssets(data);
    } catch (error) {
      console.error("加载资产失败:", error);
    } finally {
      setLoading(false);
    }
  }, [urlProjectId, selectedVersionId, ownerTypeFilter, ownerIdInput]);

  // ── Effects ──
  useEffect(() => {
    void fetchEpisodes();
  }, [fetchEpisodes]);

  useEffect(() => {
    void fetchScenes();
  }, [fetchScenes]);

  useEffect(() => {
    void fetchVersions();
  }, [fetchVersions]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  // ── Cascade helpers ──
  const handleSelectEpisode = (episodeId: string) => {
    setSelectedEpisodeId(episodeId);
    setSelectedSceneId(null);
    setSelectedVersionId(null);
    setScenes([]);
    setVersions([]);
  };

  const handleSelectScene = (sceneId: string) => {
    setSelectedSceneId(sceneId);
    setSelectedVersionId(null);
    setVersions([]);
  };

  const handleSelectVersion = (versionId: string) => {
    setSelectedVersionId(versionId);
  };

  const handleClearCascade = () => {
    setSelectedEpisodeId(null);
    setSelectedSceneId(null);
    setSelectedVersionId(null);
    setEpisodes([]);
    setScenes([]);
    setVersions([]);
  };

  // ── Upload handlers ──
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadMessage(null);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && previewAsset && inferAssetType(previewAsset.mime_type, (previewAsset.metadata_json?.original_filename as string) || previewUrl || "", previewAsset.type) === "image") {
        setPreviewAsset(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewAsset, previewUrl]);

  useEffect(() => {
    const loadPreview = async () => {
      if (!previewAsset) {
        setPreviewUrl(null);
        setPreviewText(null);
        setPreviewError(null);
        return;
      }
      try {
        setPreviewLoading(true);
        setPreviewError(null);
        setPreviewText(null);
        const preview = await apiClient.getAssetPreview(previewAsset.id);
        setPreviewUrl(preview.url);
        const previewKind = inferAssetType(
          previewAsset.mime_type,
          (previewAsset.metadata_json?.original_filename as string) || preview.url,
          previewAsset.type
        );
        if (previewKind === "document") {
          const text = await fetch(preview.url).then((r) => {
            if (!r.ok) throw new Error(`文本预览失败: ${r.status}`);
            return r.text();
          });
          setPreviewText(text);
        }
      } catch (error) {
        console.error("加载预览失败:", error);
        setPreviewError(error instanceof Error ? error.message : "预览加载失败");
      } finally {
        setPreviewLoading(false);
      }
    };
    void loadPreview();
  }, [previewAsset]);

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadMessage({ type: "error", text: "请先选择文件" });
      return;
    }
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("asset_type", inferAssetType(selectedFile.type));
    try {
      setUploading(true);
      const result: UploadResponse = await apiClient.uploadFile(formData);
      setUploadMessage({
        type: "success",
        text: `上传成功: ${result.message}`,
      });
      setSelectedFile(null);
      const fileInput = document.getElementById(
        "file-upload"
      ) as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      await loadAssets();
    } catch (error) {
      console.error("上传失败:", error);
      setUploadMessage({
        type: "error",
        text: error instanceof Error ? error.message : "上传失败",
      });
    } finally {
      setUploading(false);
    }
  };

  // ── Link handlers ──
  const handleCreateLink = async () => {
    if (!linkAssetId || !linkOwnerType || !linkOwnerId) {
      setLinkMessage({ type: "error", text: "请填写所有字段" });
      return;
    }
    try {
      setLinking(true);
      setLinkMessage(null);
      await apiClient.createAssetLink(linkAssetId, {
        owner_type: linkOwnerType,
        owner_id: linkOwnerId,
      });
      setLinkMessage({ type: "success", text: "关联创建成功" });
      setLinkAssetId("");
      setLinkOwnerType("");
      setLinkOwnerId("");
    } catch (error) {
      console.error("关联创建失败:", error);
      setLinkMessage({
        type: "error",
        text: error instanceof Error ? error.message : "关联创建失败",
      });
    } finally {
      setLinking(false);
    }
  };

  // ── Filtering ──
  const uniqueTypes = useMemo(() => {
    return [...new Set(assets.map((a) => a.type))].sort();
  }, [assets]);

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (assetTypeFilter !== "all" && asset.type !== assetTypeFilter)
        return false;
      if (qaEvidenceMode && asset.type !== "qa_evidence") return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchType = asset.type.toLowerCase().includes(q);
        const matchId = asset.id.toLowerCase().includes(q);
        const matchStep =
          typeof asset.metadata_json?.step === "string"
            ? asset.metadata_json.step.toLowerCase().includes(q)
            : false;
        const matchName =
          typeof asset.metadata_json?.original_filename === "string"
            ? asset.metadata_json.original_filename.toLowerCase().includes(q)
            : false;
        if (!matchType && !matchId && !matchStep && !matchName) return false;
      }
      return true;
    });
  }, [assets, assetTypeFilter, searchQuery, qaEvidenceMode]);

  const handleOwnerTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setOwnerTypeFilter(e.target.value);
    setOwnerIdInput("");
  };

  const handleQaEvidenceToggle = () => {
    if (!qaEvidenceMode) {
      setQaEvidenceMode(true);
      setAssetTypeFilter("qa_evidence");
    } else {
      setQaEvidenceMode(false);
      setAssetTypeFilter("all");
    }
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setAssetTypeFilter("all");
    setOwnerTypeFilter("");
    setOwnerIdInput("");
    setQaEvidenceMode(false);
    handleClearCascade();
  };

  // ── Render ──
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 space-y-6">
      <PageHeader
        title="资产库"
        description={urlProjectId ? `管理项目资产，支持按类型、归属、项目筛选。当前项目：${urlProjectId}` : '管理项目资产，支持按类型、归属、项目筛选。'}
        actions={<GlassButton variant="ghost" size="sm" onClick={handleResetFilters}>重置全部</GlassButton>}
      />

      {/* ── Scene Version Cascade Selector ── */}
      {urlProjectId && (
        <GlassSurface variant="panel" padded>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">
              场景版本导航
            </h2>
            {selectedVersionId && (
              <GlassButton
                variant="ghost"
                size="sm"
                onClick={handleClearCascade}
              >
                清除选择
              </GlassButton>
            )}
          </div>

          {cascadeLoading && episodes.length === 0 ? (
            <p className="text-xs text-zinc-500">加载中...</p>
          ) : episodes.length === 0 ? (
            <p className="text-xs text-zinc-500">该项目暂无剧集数据</p>
          ) : (
            <div className="space-y-3">
              {/* Episodes */}
              <div>
                <span className="mb-1.5 block text-xs text-zinc-500">集</span>
                <div className="flex flex-wrap gap-1.5">
                  {episodes.map((ep) => (
                    <GlassChip
                      key={ep.id}
                      tone={selectedEpisodeId === ep.id ? "info" : "neutral"}
                      className="cursor-pointer"
                      onRemove={undefined}
                    >
                      <button
                        onClick={() => handleSelectEpisode(ep.id)}
                        className="text-xs"
                      >
                        E{ep.episode_no}
                        {ep.title ? ` · ${ep.title}` : ""}
                      </button>
                    </GlassChip>
                  ))}
                </div>
              </div>

              {/* Scenes */}
              {selectedEpisodeId && scenes.length > 0 && (
                <div>
                  <span className="mb-1.5 block text-xs text-zinc-500">
                    场景
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {scenes.map((s) => (
                      <GlassChip
                        key={s.id}
                        tone={selectedSceneId === s.id ? "info" : "neutral"}
                        className="cursor-pointer"
                        onRemove={undefined}
                      >
                        <button
                          onClick={() => handleSelectScene(s.id)}
                          className="text-xs"
                        >
                          S{String(s.scene_no).padStart(2, "0")}
                          {s.title ? ` · ${s.title}` : ""}
                        </button>
                      </GlassChip>
                    ))}
                  </div>
                </div>
              )}

              {/* Versions */}
              {selectedSceneId && versions.length > 0 && (
                <div>
                  <span className="mb-1.5 block text-xs text-zinc-500">
                    版本
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {versions.map((v) => {
                      const isLatest = v === versions[versions.length - 1];
                      return (
                        <GlassChip
                          key={v.id}
                          tone={
                            selectedVersionId === v.id ? "success" : "neutral"
                          }
                          className="cursor-pointer"
                          onRemove={undefined}
                        >
                          <button
                            onClick={() => handleSelectVersion(v.id)}
                            className="text-xs font-mono"
                          >
                            v{v.version_no}
                            {isLatest ? " (最新)" : ""}
                          </button>
                        </GlassChip>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Status indicator */}
              {selectedVersionId && (
                <p className="text-xs text-zinc-400">
                  ✓ 已选择版本，资产列表已过滤
                </p>
              )}
              {selectedSceneId && versions.length === 0 && !cascadeLoading && (
                <p className="text-xs text-zinc-500">该场景暂无版本</p>
              )}
            </div>
          )}
        </GlassSurface>
      )}

      {/* ── Filter bar ── */}
      <GlassSurface variant="panel" padded>
        <div className="mb-4 flex flex-col gap-4">
          {/* Search */}
          <GlassField label="搜索资产">
            <GlassInput
              type="text"
              placeholder="搜索类型、ID、步骤或文件名..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </GlassField>

          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            {/* Asset type chips */}
            <div className="flex flex-1 flex-col gap-2">
              <span className="text-xs text-zinc-400">资产类型:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setAssetTypeFilter("all")}
                  className={`${
                    assetTypeFilter === "all"
                      ? "bg-zinc-700 ring-1 ring-zinc-600"
                      : "bg-zinc-800 hover:bg-zinc-700"
                  } rounded px-2.5 py-1 text-xs font-medium transition-all`}
                >
                  全部
                </button>
                {uniqueTypes.map((type) => {
                  const isActive = assetTypeFilter === type;
                  const label = getAssetTypeLabel(type);
                  const color = getAssetTypeColor(type);
                  return (
                    <button
                      key={type}
                      onClick={() => setAssetTypeFilter(type)}
                      className={`${
                        isActive ? "ring-1" : "hover:bg-zinc-700"
                      } rounded px-2.5 py-1 text-xs font-medium transition-all`}
                      style={{
                        backgroundColor: isActive ? `${color}20` : "#27272a",
                        borderColor: isActive ? color : "transparent",
                        color: isActive ? color : "#a1a1aa",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Owner type + QA toggle */}
            <div className="flex flex-col gap-3 md:w-80">
              <GlassField label="归属类型">
                <select
                  value={ownerTypeFilter}
                  onChange={handleOwnerTypeChange}
                  disabled={!!selectedVersionId}
                  className="glass-input-base h-9 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm leading-5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
                >
                  {OWNER_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </GlassField>

              {ownerTypeFilter && !selectedVersionId && (
                <GlassField label="归属对象 ID">
                  <div className="flex gap-2">
                    <GlassInput
                      type="text"
                      placeholder="输入对象 ID..."
                      value={ownerIdInput}
                      onChange={(e) => setOwnerIdInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void loadAssets();
                      }}
                      className="flex-1"
                    />
                    <GlassButton
                      variant="primary"
                      size="sm"
                      onClick={() => void loadAssets()}
                      disabled={!ownerIdInput.trim()}
                    >
                      查询
                    </GlassButton>
                  </div>
                </GlassField>
              )}

              <GlassButton
                variant={qaEvidenceMode ? "primary" : "secondary"}
                size="sm"
                onClick={handleQaEvidenceToggle}
              >
                {qaEvidenceMode ? "退出 QA 视图" : "查看 QA 证据"}
              </GlassButton>
            </div>
          </div>

          {/* Result count */}
          <div className="flex items-center justify-between border-t border-zinc-800 pt-2">
            <span className="text-sm text-zinc-400">
              显示 {filteredAssets.length} / {assets.length} 项
            </span>
          </div>
        </div>
      </GlassSurface>

      {/* ── Upload area ── */}
      <GlassSurface variant="panel" padded>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">上传资产</h2>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <input
              id="file-upload"
              type="file"
              onChange={handleFileSelect}
              disabled={uploading}
              className="flex-1 text-sm text-zinc-300 file:mr-4 file:rounded-md file:border-0 file:bg-violet-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-violet-700 disabled:opacity-50"
            />
            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:bg-violet-600/50 disabled:opacity-50"
            >
              {uploading ? "上传中..." : "上传"}
            </button>
          </div>
          {selectedFile && (
            <p className="text-xs text-zinc-400">
              已选择: {selectedFile.name} ({formatFileSize(selectedFile.size)})
            </p>
          )}
          {uploadMessage && (
            <p
              className={`text-sm ${
                uploadMessage.type === "success"
                  ? "text-green-400"
                  : "text-red-400"
              }`}
            >
              {uploadMessage.text}
            </p>
          )}
        </div>
      </GlassSurface>

      {/* ── Link area ── */}
      <GlassSurface variant="panel" padded>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">关联资产</h2>
        </div>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label
                htmlFor="link-asset-id"
                className="mb-1 block text-xs text-zinc-400"
              >
                资产 ID
              </label>
              <input
                id="link-asset-id"
                type="text"
                value={linkAssetId}
                onChange={(e) => setLinkAssetId(e.target.value)}
                disabled={linking}
                placeholder="输入资产 ID"
                className="w-full rounded-md bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label
                htmlFor="link-owner-type"
                className="mb-1 block text-xs text-zinc-400"
              >
                归属类型 (owner_type)
              </label>
              <input
                id="link-owner-type"
                type="text"
                value={linkOwnerType}
                onChange={(e) => setLinkOwnerType(e.target.value)}
                disabled={linking}
                placeholder="例如: project, episode"
                className="w-full rounded-md bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label
                htmlFor="link-owner-id"
                className="mb-1 block text-xs text-zinc-400"
              >
                归属对象 ID (owner_id)
              </label>
              <input
                id="link-owner-id"
                type="text"
                value={linkOwnerId}
                onChange={(e) => setLinkOwnerId(e.target.value)}
                disabled={linking}
                placeholder="输入对象 ID"
                className="w-full rounded-md bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
              />
            </div>
          </div>
          <button
            onClick={handleCreateLink}
            disabled={!linkAssetId || !linkOwnerType || !linkOwnerId || linking}
            className="self-start rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:bg-violet-600/50 disabled:opacity-50"
          >
            {linking ? "关联中..." : "创建关联"}
          </button>
          {linkMessage && (
            <p
              className={`text-sm ${
                linkMessage.type === "success"
                  ? "text-green-400"
                  : "text-red-400"
              }`}
            >
              {linkMessage.text}
            </p>
          )}
        </div>
      </GlassSurface>

      {/* ── Asset list ── */}
      <GlassSurface variant="panel" padded>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">
            资产列表 ({filteredAssets.length})
          </h2>
          <span className="text-xs text-zinc-500">数据源：GET /api/assets/</span>
        </div>

        {loading ? (
          <p className="text-zinc-400">加载中...</p>
        ) : assets.length === 0 ? (
          <p className="text-zinc-400">暂无资产</p>
        ) : filteredAssets.length === 0 ? (
          <p className="text-zinc-400">无匹配结果</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredAssets.map((asset) => (
              <GlassSurface key={asset.id} variant="elevated" padded>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span
                      className="rounded px-2 py-1 text-xs font-medium"
                      style={{
                        backgroundColor: `${getAssetTypeColor(asset.type)}20`,
                        color: getAssetTypeColor(asset.type),
                      }}
                    >
                      {getAssetTypeLabel(asset.type)}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {formatFileSize(asset.file_size)}
                    </span>
                  </div>

                  <div>
                    <p className="truncate text-sm font-medium text-zinc-100">
                      {(asset.metadata_json?.original_filename as string) ||
                        asset.id}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">ID: {asset.id}</p>
                    {typeof asset.metadata_json?.step === "string" && (
                      <p className="mt-1 text-xs text-zinc-600">
                        步骤: {asset.metadata_json.step}
                      </p>
                    )}
                  </div>

                  {asset.mime_type ? (
                    <p className="truncate text-xs text-zinc-500">
                      {asset.mime_type}
                    </p>
                  ) : null}

                  <div className="flex items-center gap-2">
                    {asset.uri ? (
                      <a
                        href={asset.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-xs text-violet-400 hover:underline"
                      >
                        打开资源
                      </a>
                    ) : (
                      <span className="text-xs text-zinc-600">无可访问链接</span>
                    )}
                    <button
                      onClick={() => {
                        setPreviewAsset(asset);
                        setPreviewUrl(null);
                        setPreviewText(null);
                        setPreviewError(null);
                        setImagePreviewMode("fit");
                        setImageZoom(100);
                        setImageOffset({ x: 0, y: 0 });
                        setDraggingImage(false);
                        setDragStart(null);
                        setVideoMeta({});
                      }}
                      className="rounded-md bg-zinc-700 px-3 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-600"
                    >
                      预览
                    </button>
                  </div>

                  <p className="text-xs text-zinc-600">
                    {new Date(asset.created_at).toLocaleString("zh-CN")}
                  </p>
                </div>
              </GlassSurface>
            ))}
          </div>
        )}
      </GlassSurface>

      {/* ── Image fullscreen preview ── */}
      {previewAsset && previewUrl && inferAssetType(previewAsset.mime_type, (previewAsset.metadata_json?.original_filename as string) || previewUrl, previewAsset.type) === "image" && !previewLoading && !previewError ? (
        <div
          className="fixed inset-0 z-[140] bg-black/92"
          onWheelCapture={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setImagePreviewMode("full");
            setImageZoom((z) => {
              const next = Math.max(25, Math.min(400, z + (e.deltaY < 0 ? 12 : -12)));
              if (next <= 100) setImageOffset({ x: 0, y: 0 });
              return next;
            });
          }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-4 z-[150] flex justify-center">
            <div className="rounded-full border border-white/10 bg-black/45 px-4 py-2 text-xs text-white/85 shadow-lg backdrop-blur-sm animate-pulse">
              ESC 退出预览 · 滚轮缩放 · 拖拽移动 · 双击放大/还原
            </div>
          </div>
          <div className="absolute right-4 top-16 z-[150] flex items-center gap-2 rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-sm text-white shadow-lg backdrop-blur-sm">
            <span>{imageZoom}%</span>
            <button type="button" onClick={() => { setImagePreviewMode("full"); setImageZoom((z) => Math.max(25, z - 25)); if (imageZoom <= 125) setImageOffset({ x: 0, y: 0 }); }} className="rounded bg-white/10 px-3 py-1.5 text-base font-semibold">−</button>
            <button type="button" onClick={() => { setImagePreviewMode("full"); setImageZoom((z) => Math.min(400, z + 25)); }} className="rounded bg-white/10 px-3 py-1.5 text-base font-semibold">+</button>
            <button type="button" onClick={() => { setImageZoom(100); setImageOffset({ x: 0, y: 0 }); }} className="rounded bg-white/10 px-3 py-1.5">重置</button>
            <button type="button" onClick={() => setPreviewAsset(null)} className="rounded bg-amber-500/80 px-3 py-1.5 font-medium text-white">退出预览</button>
          </div>
          <button type="button" onClick={() => setPreviewAsset(null)} className="absolute right-4 top-4 z-[150] rounded-full bg-black/50 px-3 py-2 text-sm text-white">关闭</button>
          <div className="flex h-full w-full items-center justify-center overflow-hidden p-6">
            <img
              src={previewUrl}
              alt={(previewAsset.metadata_json?.original_filename as string) || "预览"}
              onDoubleClick={() => {
                setImagePreviewMode("full");
                setImageZoom((z) => (z === 100 ? 200 : 100));
              }}
              onMouseDown={(e) => {
                if (imageZoom <= 100) return;
                setDraggingImage(true);
                setDragStart({ x: e.clientX, y: e.clientY, originX: imageOffset.x, originY: imageOffset.y });
              }}
              onMouseUp={() => { setDraggingImage(false); setDragStart(null); }}
              onMouseLeave={() => { setDraggingImage(false); setDragStart(null); }}
              onMouseMove={(e) => {
                if (!draggingImage || !dragStart || imageZoom <= 100) return;
                setImageOffset({ x: dragStart.originX + (e.clientX - dragStart.x), y: dragStart.originY + (e.clientY - dragStart.y) });
              }}
              style={{ transform: `translate3d(${imageOffset.x}px, ${imageOffset.y}px, 0) scale(${imageZoom / 100})`, transformOrigin: "center center", maxHeight: "calc(100vh - 48px)", maxWidth: "calc(100vw - 48px)" }}
              className={`${draggingImage ? "cursor-grabbing" : imageZoom > 100 ? "cursor-grab" : "cursor-zoom-in"} select-none object-contain transition-transform`}
            />
          </div>
        </div>
      ) : null}

      {/* ── Preview modal ── */}
      <GlassModalShell
        open={!!previewAsset && !(previewUrl && previewAsset && inferAssetType(previewAsset.mime_type, (previewAsset.metadata_json?.original_filename as string) || previewUrl, previewAsset.type) === "image" && !previewLoading && !previewError)}
        onClose={() => setPreviewAsset(null)}
        closeOnEsc={false}
        title={
          (previewAsset?.metadata_json?.original_filename as string) ??
          previewAsset?.id ??
          "预览"
        }
        size="lg"
      >
        {previewAsset && (
          <div className="space-y-4">
            <div className="space-y-2 text-sm text-zinc-300">
              <div className="flex items-center gap-4">
                <span className="text-zinc-500">类型:</span>
                <span
                  className="rounded px-2 py-1 text-xs font-medium"
                  style={{
                    backgroundColor: `${getAssetTypeColor(previewAsset.type)}20`,
                    color: getAssetTypeColor(previewAsset.type),
                  }}
                >
                  {getAssetTypeLabel(previewAsset.type)}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-zinc-500">大小:</span>
                <span>{formatFileSize(previewAsset.file_size)}</span>
              </div>
              {previewAsset.mime_type && (
                <div className="flex items-center gap-4">
                  <span className="text-zinc-500">MIME:</span>
                  <span className="truncate text-xs">
                    {previewAsset.mime_type}
                  </span>
                </div>
              )}
              {previewAsset.duration && (
                <div className="flex items-center gap-4">
                  <span className="text-zinc-500">时长:</span>
                  <span>{(previewAsset.duration / 60).toFixed(1)} 秒</span>
                </div>
              )}
              {previewAsset.width && previewAsset.height && (
                <div className="flex items-center gap-4">
                  <span className="text-zinc-500">尺寸:</span>
                  <span>
                    {previewAsset.width} × {previewAsset.height}
                  </span>
                </div>
              )}
            </div>

            {inferAssetType(previewAsset.mime_type, (previewAsset.metadata_json?.original_filename as string) || previewUrl || "", previewAsset.type) === "image" && (
              <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300">
                <div className="flex items-center gap-2">
                  <span>图片预览</span>
                  <span className="text-zinc-500">{previewAsset.width && previewAsset.height ? `${previewAsset.width} × ${previewAsset.height}` : "原始尺寸信息缺失"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500">缩放 {imageZoom}%</span>
                  <button
                    type="button"
                    onClick={() => { setImagePreviewMode("fit"); setImageZoom(100); setImageOffset({ x: 0, y: 0 }); }}
                    className={`rounded px-2 py-1 ${imagePreviewMode === "fit" ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-300"}`}
                  >
                    适配窗口
                  </button>
                  <button
                    type="button"
                    onClick={() => { setImagePreviewMode("full"); setImageZoom(100); setImageOffset({ x: 0, y: 0 }); }}
                    className={`rounded px-2 py-1 ${imagePreviewMode === "full" ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-300"}`}
                  >
                    原始尺寸
                  </button>
                  <button type="button" onClick={() => { setImagePreviewMode("full"); setImageZoom((z) => Math.max(25, z - 25)); if (imageZoom <= 125) setImageOffset({ x: 0, y: 0 }); }} className="rounded bg-zinc-800 px-3 py-1.5 text-base font-semibold text-zinc-200">−</button>
                  <button type="button" onClick={() => { setImagePreviewMode("full"); setImageZoom((z) => Math.min(400, z + 25)); }} className="rounded bg-zinc-800 px-3 py-1.5 text-base font-semibold text-zinc-200">+</button>
                  <button type="button" onClick={() => { setImageZoom(100); setImageOffset({ x: 0, y: 0 }); setImagePreviewMode("fit"); }} className="rounded bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200">重置</button>
                  <button type="button" onClick={() => { setImageZoom(100); setImageOffset({ x: 0, y: 0 }); setImagePreviewMode("fit"); }} className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white">退出放大</button>
                </div>
              </div>
            )}

            <div className="h-px bg-zinc-700" />

            {previewLoading ? (
              <div className="flex min-h-[200px] items-center justify-center bg-zinc-900/50 p-4">
                <p className="text-sm text-zinc-400">预览加载中...</p>
              </div>
            ) : previewError ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 bg-zinc-900/50 p-4 text-center">
                <p className="text-sm text-amber-400">预览失败</p>
                <p className="max-w-lg text-xs text-zinc-500">{previewError}</p>
              </div>
            ) : previewUrl ? (
              <div
                className="flex min-h-[300px] items-center justify-center overflow-hidden bg-zinc-900/50 p-4"
                onWheelCapture={(e) => {
                  if (inferAssetType(previewAsset.mime_type, (previewAsset.metadata_json?.original_filename as string) || previewUrl, previewAsset.type) !== "image") return;
                  e.preventDefault();
                  e.stopPropagation();
                  setImagePreviewMode("full");
                  setImageZoom((z) => {
                    const next = Math.max(25, Math.min(400, z + (e.deltaY < 0 ? 12 : -12)));
                    if (next <= 100) setImageOffset({ x: 0, y: 0 });
                    return next;
                  });
                }}
              >
                {inferAssetType(previewAsset.mime_type, (previewAsset.metadata_json?.original_filename as string) || previewUrl, previewAsset.type) === "image" ? (
                  <img
                    src={previewUrl}
                    alt={
                      (previewAsset.metadata_json?.original_filename as string) ||
                      "预览"
                    }
                    onDoubleClick={() => {
                      setImagePreviewMode("full");
                      setImageZoom((z) => (z === 100 ? 200 : 100));
                    }}
                    onMouseDown={(e) => {
                      if (imagePreviewMode !== "full" || imageZoom <= 100) return;
                      setDraggingImage(true);
                      setDragStart({ x: e.clientX, y: e.clientY, originX: imageOffset.x, originY: imageOffset.y });
                    }}
                    onMouseUp={() => { setDraggingImage(false); setDragStart(null); }}
                    onMouseLeave={() => { setDraggingImage(false); setDragStart(null); }}
                    onMouseMove={(e) => {
                      if (!draggingImage || !dragStart || imagePreviewMode !== "full" || imageZoom <= 100) return;
                      setImageOffset({ x: dragStart.originX + (e.clientX - dragStart.x), y: dragStart.originY + (e.clientY - dragStart.y) });
                    }}
                    style={imagePreviewMode === "full" ? { transform: `translate3d(${imageOffset.x}px, ${imageOffset.y}px, 0) scale(${imageZoom / 100})`, transformOrigin: "center center" } : undefined}
                    className={imagePreviewMode === "full" ? `${draggingImage ? "cursor-grabbing" : imageZoom > 100 ? "cursor-grab" : "cursor-zoom-in"} h-auto w-auto max-w-none object-contain transition-transform` : "max-h-[60vh] w-auto cursor-zoom-in object-contain transition-transform"}
                  />
                ) : inferAssetType(previewAsset.mime_type, (previewAsset.metadata_json?.original_filename as string) || previewUrl, previewAsset.type) === "video" ? (
                  <div className="w-full space-y-3">
                    <video
                      src={previewUrl}
                      controls
                      className="max-h-[60vh] w-full rounded-md bg-black"
                      onLoadedMetadata={(e) => {
                        const el = e.currentTarget;
                        const bitrateKbps = previewAsset.file_size && el.duration > 0 ? Math.round((previewAsset.file_size * 8) / el.duration / 1000) : undefined;
                        setVideoMeta({ duration: el.duration, width: el.videoWidth, height: el.videoHeight, bitrateKbps });
                      }}
                    >您的浏览器不支持视频播放</video>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                      {(videoMeta.width && videoMeta.height) || (previewAsset.width && previewAsset.height) ? <span>分辨率: {videoMeta.width || previewAsset.width} × {videoMeta.height || previewAsset.height}</span> : null}
                      {previewAsset.file_size ? <span>大小: {formatFileSize(previewAsset.file_size)}</span> : null}
                      {videoMeta.duration ? <span>时长: {videoMeta.duration.toFixed(1)} 秒</span> : null}
                      {videoMeta.bitrateKbps ? <span>码率: {videoMeta.bitrateKbps} kbps</span> : null}
                      <span>当前为原文件预览，未做前端压缩</span>
                    </div>
                  </div>
                ) : inferAssetType(previewAsset.mime_type, (previewAsset.metadata_json?.original_filename as string) || previewUrl, previewAsset.type) === "audio" ? (
                  <audio src={previewUrl} controls className="w-full">您的浏览器不支持音频播放</audio>
                ) : previewText !== null ? (
                  <pre className="max-h-[60vh] w-full overflow-auto whitespace-pre-wrap rounded-md bg-zinc-950 p-4 text-left text-xs text-zinc-200">{previewText}</pre>
                ) : (
                  <div className="space-y-3 text-center">
                    <p className="text-sm text-zinc-400">该文件类型暂不支持在线预览</p>
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
                    >
                      打开文件
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex min-h-[200px] items-center justify-center bg-zinc-900/50 p-4">
                <p className="text-sm text-zinc-500">无可预览链接</p>
              </div>
            )}

            {previewUrl && (
              <div className="flex justify-center gap-3">
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md bg-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-600"
                >
下载 / 打开原文件
                </a>
              </div>
            )}
          </div>
        )}
      </GlassModalShell>
    </div>
  );
}

export default function AssetHubPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center text-zinc-400">加载中...</div>}>
      <AssetHubContent />
    </Suspense>
  );
}
