"use client";

import { useMemo } from "react";
import GlassSurface from "@/components/ui/primitives/GlassSurface";
import GlassInput from "@/components/ui/primitives/GlassInput";
import GlassButton from "@/components/ui/primitives/GlassButton";
import GlassField from "@/components/ui/primitives/GlassField";
import { type Asset, apiClient } from "@/lib/api-client";
import { OWNER_TYPE_OPTIONS, getAssetTypeLabel, getAssetTypeColor } from "./types";

interface AssetFilterBarProps {
  assets: Asset[];
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  assetTypeFilter: string;
  onAssetTypeFilterChange: (f: string) => void;
  ownerTypeFilter: string;
  onOwnerTypeFilterChange: (f: string) => void;
  ownerIdInput: string;
  onOwnerIdInputChange: (v: string) => void;
  qaEvidenceMode: boolean;
  onQaEvidenceToggle: () => void;
  onReset: () => void;
  onRefreshAssets: () => void;
  selectedVersionId: string | null;
  filteredCount: number;
}

export default function AssetFilterBar({
  assets,
  searchQuery,
  onSearchQueryChange,
  assetTypeFilter,
  onAssetTypeFilterChange,
  ownerTypeFilter,
  onOwnerTypeFilterChange,
  ownerIdInput,
  onOwnerIdInputChange,
  qaEvidenceMode,
  onQaEvidenceToggle,
  onReset,
  onRefreshAssets,
  selectedVersionId,
  filteredCount,
}: AssetFilterBarProps) {
  const uniqueTypes = useMemo(() => [...new Set(assets.map((a) => a.type))].sort(), [assets]);

  const handleOwnerTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onOwnerTypeFilterChange(e.target.value);
    onOwnerIdInputChange("");
  };

  return (
    <GlassSurface variant="panel" padded>
      <div className="mb-4 flex flex-col gap-4">
        <GlassField label="搜索资产">
          <GlassInput
            type="text"
            placeholder="搜索类型、ID、步骤或文件名..."
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="w-full"
          />
        </GlassField>
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <div className="flex flex-1 flex-col gap-2">
            <span className="text-xs text-zinc-400">资产类型:</span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onAssetTypeFilterChange("all")}
                className={`${assetTypeFilter === "all" ? "bg-zinc-700 ring-1 ring-zinc-600" : "bg-zinc-800 hover:bg-zinc-700"} rounded px-2.5 py-1 text-xs font-medium transition-all`}
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
                    onClick={() => onAssetTypeFilterChange(type)}
                    className={`${isActive ? "ring-1" : "hover:bg-zinc-700"} rounded px-2.5 py-1 text-xs font-medium transition-all`}
                    style={{ backgroundColor: isActive ? `${color}20` : "#27272a", borderColor: isActive ? color : "transparent", color: isActive ? color : "#a1a1aa" }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-3 md:w-80">
            <GlassField label="归属类型">
              <select
                value={ownerTypeFilter}
                onChange={handleOwnerTypeChange}
                disabled={!!selectedVersionId}
                className="glass-input-base h-9 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm leading-5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
              >
                {OWNER_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
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
                    onChange={(e) => onOwnerIdInputChange(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") onRefreshAssets(); }}
                    className="flex-1"
                  />
                  <GlassButton variant="primary" size="sm" onClick={onRefreshAssets} disabled={!ownerIdInput.trim()}>查询</GlassButton>
                </div>
              </GlassField>
            )}
            <GlassButton variant={qaEvidenceMode ? "primary" : "secondary"} size="sm" onClick={onQaEvidenceToggle}>
              {qaEvidenceMode ? "退出 QA 视图" : "查看 QA 证据"}
            </GlassButton>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-zinc-800 pt-2">
          <span className="text-sm text-zinc-400">显示 {filteredCount} / {assets.length} 项</span>
        </div>
      </div>
    </GlassSurface>
  );
}
