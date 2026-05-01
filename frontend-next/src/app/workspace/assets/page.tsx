"use client";

import { Suspense, useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/workspace/PageHeader";
import GlassButton from "@/components/ui/primitives/GlassButton";
import GlassSurface from "@/components/ui/primitives/GlassSurface";
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
  const [totalAssets, setTotalAssets] = useState(0);
  const [loading, setLoading] = useState(true);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

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
  const loadAssets = useCallback(async (page?: number) => {
    try {
      setLoading(true);
      const p = page ?? currentPage;
      const params: Parameters<typeof apiClient.listAssets>[0] = { limit: pageSize, skip: (p - 1) * pageSize };
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
      setTotalAssets(data.total);
    } catch (error) { console.error("加载资产失败:", error); }
    finally { setLoading(false); }
  }, [urlProjectId, selectedVersionId, ownerTypeFilter, ownerIdInput, currentPage, pageSize]);

  useEffect(() => { void loadAssets(); }, [loadAssets]);

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [urlProjectId, selectedVersionId, ownerTypeFilter]);

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
    setSelectedVersionId(null); setCurrentPage(1);
  };

  const handleClearCascade = () => setSelectedVersionId(null);

  const handlePreview = (asset: Asset) => {
    setPreviewAsset(asset); setPreviewUrl(null); setPreviewError(null);
  };

  // ── Pagination helpers ──
  const totalPages = Math.max(1, Math.ceil(totalAssets / pageSize));
  const goToPage = (page: number) => { setCurrentPage(page); void loadAssets(page); };

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

      {/* Pagination */}
      {totalAssets > 0 && (
        <GlassSurface variant="panel" padded>
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">
              共 {totalAssets} 条，第 {currentPage} / {totalPages} 页
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => goToPage(1)}
                disabled={currentPage === 1}
                className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
              >首页</button>
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
              >上一页</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                .reduce<(number | string)[]>((acc, p, i, arr) => {
                  if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  typeof p === "string" ? (
                    <span key={`dots-${i}`} className="px-1 text-xs text-zinc-500">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => goToPage(p)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium ${p === currentPage ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
                    >{p}</button>
                  )
                )}
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
              >下一页</button>
              <button
                onClick={() => goToPage(totalPages)}
                disabled={currentPage === totalPages}
                className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
              >末页</button>
            </div>
          </div>
        </GlassSurface>
      )}

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
