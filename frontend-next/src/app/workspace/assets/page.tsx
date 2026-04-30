"use client";

import { Suspense, useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/workspace/PageHeader";
import GlassButton from "@/components/ui/primitives/GlassButton";
import { apiClient, type Asset } from "@/lib/api-client";
import { inferAssetType } from "./components/types";
import SceneCascadeSelector from "./components/SceneCascadeSelector";
import AssetFilterBar from "./components/AssetFilterBar";
import AssetUploadPanel from "./components/AssetUploadPanel";
import AssetLinkPanel from "./components/AssetLinkPanel";
import AssetList from "./components/AssetList";
import AssetPreviewModal from "./components/AssetPreviewModal";
import ImagePreviewFullscreen from "./components/ImagePreviewFullscreen";

export const dynamic = "force-dynamic";

function AssetHubContent() {
  const searchParams = useSearchParams();
  const urlProjectId = searchParams.get("project_id") ?? undefined;

  // ── Core state ──
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);

  // ── Filter state ──
  const [searchQuery, setSearchQuery] = useState("");
  const [assetTypeFilter, setAssetTypeFilter] = useState("all");
  const [ownerTypeFilter, setOwnerTypeFilter] = useState("");
  const [ownerIdInput, setOwnerIdInput] = useState("");
  const [qaEvidenceMode, setQaEvidenceMode] = useState(false);

  // ── Scene Version cascade ──
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  // ── Preview state ──
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // ── Fetch assets ──
  const loadAssets = useCallback(async () => {
    try {
      setLoading(true);
      const params: Parameters<typeof apiClient.listAssets>[0] = { limit: 200 };
      if (urlProjectId) params.project_id = urlProjectId;
      if (selectedVersionId) {
        params.owner_type = "scene_version";
        params.owner_id = selectedVersionId;
      } else if (ownerTypeFilter) {
        params.owner_type = ownerTypeFilter;
        if (ownerIdInput.trim()) params.owner_id = ownerIdInput.trim();
      }
      const data = await apiClient.listAssets(params);
      setAssets(data.items);
    } catch (error) { console.error("加载资产失败:", error); }
    finally { setLoading(false); }
  }, [urlProjectId, selectedVersionId, ownerTypeFilter, ownerIdInput]);

  useEffect(() => { void loadAssets(); }, [loadAssets]);

  // ── Preview URL loading (for fullscreen image detection) ──
  useEffect(() => {
    const loadPreviewUrl = async () => {
      if (!previewAsset) { setPreviewUrl(null); setPreviewError(null); return; }
      try {
        setPreviewLoading(true); setPreviewError(null);
        const base = typeof window !== "undefined" ? "/api" : "http://localhost:8000/api";
        const serveUrl = `${base}/files/serve/${previewAsset.id}`;
        setPreviewUrl(serveUrl);
      } catch (error) {
        setPreviewError(error instanceof Error ? error.message : "预览加载失败");
      } finally { setPreviewLoading(false); }
    };
    void loadPreviewUrl();
  }, [previewAsset]);

  // ── ESC to close fullscreen image preview ──
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && previewAsset && previewUrl) {
        const kind = inferAssetType(previewAsset.mime_type, (previewAsset.metadata_json?.original_filename as string) || previewUrl, previewAsset.type);
        if (kind === "image" && !previewLoading && !previewError) setPreviewAsset(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewAsset, previewUrl, previewLoading, previewError]);

  // ── Filtering ──
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (assetTypeFilter !== "all" && asset.type !== assetTypeFilter) return false;
      if (qaEvidenceMode && asset.type !== "qa_evidence") return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchType = asset.type.toLowerCase().includes(q);
        const matchId = asset.id.toLowerCase().includes(q);
        const matchStep = typeof asset.metadata_json?.step === "string" ? asset.metadata_json.step.toLowerCase().includes(q) : false;
        const matchName = typeof asset.metadata_json?.original_filename === "string" ? asset.metadata_json.original_filename.toLowerCase().includes(q) : false;
        if (!matchType && !matchId && !matchStep && !matchName) return false;
      }
      return true;
    });
  }, [assets, assetTypeFilter, searchQuery, qaEvidenceMode]);

  // ── Handlers ──
  const handleQaEvidenceToggle = () => {
    if (!qaEvidenceMode) { setQaEvidenceMode(true); setAssetTypeFilter("qa_evidence"); }
    else { setQaEvidenceMode(false); setAssetTypeFilter("all"); }
  };

  const handleResetFilters = () => {
    setSearchQuery(""); setAssetTypeFilter("all"); setOwnerTypeFilter(""); setOwnerIdInput(""); setQaEvidenceMode(false);
    setSelectedVersionId(null);
  };

  const handleClearCascade = () => setSelectedVersionId(null);

  const handlePreview = (asset: Asset) => {
    setPreviewAsset(asset); setPreviewUrl(null); setPreviewError(null);
  };

  // ── Fullscreen image preview detection ──
  const showFullscreenImage = previewAsset && previewUrl &&
    inferAssetType(previewAsset.mime_type, (previewAsset.metadata_json?.original_filename as string) || previewUrl, previewAsset.type) === "image" &&
    !previewLoading && !previewError;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 space-y-6">
      <PageHeader
        title="资产库"
        description={urlProjectId ? `管理项目资产，支持按类型、归属、项目筛选。当前项目：${urlProjectId}` : "管理项目资产，支持按类型、归属、项目筛选。"}
        actions={<GlassButton variant="ghost" size="sm" onClick={handleResetFilters}>重置全部</GlassButton>}
      />

      <SceneCascadeSelector
        projectId={urlProjectId}
        selectedVersionId={selectedVersionId}
        onSelectVersion={setSelectedVersionId}
        onClear={handleClearCascade}
      />

      <AssetFilterBar
        assets={assets}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        assetTypeFilter={assetTypeFilter}
        onAssetTypeFilterChange={setAssetTypeFilter}
        ownerTypeFilter={ownerTypeFilter}
        onOwnerTypeFilterChange={setOwnerTypeFilter}
        ownerIdInput={ownerIdInput}
        onOwnerIdInputChange={setOwnerIdInput}
        qaEvidenceMode={qaEvidenceMode}
        onQaEvidenceToggle={handleQaEvidenceToggle}
        onReset={handleResetFilters}
        onRefreshAssets={loadAssets}
        selectedVersionId={selectedVersionId}
        filteredCount={filteredAssets.length}
      />

      <AssetUploadPanel projectId={urlProjectId} onUploaded={loadAssets} />

      <AssetLinkPanel />

      <AssetList assets={assets} filteredAssets={filteredAssets} loading={loading} onPreview={handlePreview} />

      {showFullscreenImage && (
        <ImagePreviewFullscreen
          asset={previewAsset!}
          previewUrl={previewUrl!}
          onClose={() => setPreviewAsset(null)}
        />
      )}

      <AssetPreviewModal asset={previewAsset} onClose={() => setPreviewAsset(null)} />
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
