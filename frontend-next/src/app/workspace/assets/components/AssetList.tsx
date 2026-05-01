"use client";

import GlassSurface from "@/components/ui/primitives/GlassSurface";
import { ListSkeleton } from "@/components/Skeleton";
import { type Asset } from "@/lib/api-client";
import { formatFileSize, getAssetTypeLabel, getAssetTypeColor, getAssetServeUrl, isMockUri } from "./types";

interface AssetListProps {
  assets: Asset[];
  filteredAssets: Asset[];
  loading: boolean;
  onPreview: (asset: Asset) => void;
}

export default function AssetList({ assets, filteredAssets, loading, onPreview }: AssetListProps) {
  return (
    <GlassSurface variant="panel" padded>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">资产列表 ({filteredAssets.length})</h2>
        <span className="text-xs text-zinc-500">数据源：GET /api/assets/</span>
      </div>

      {loading ? (
        <ListSkeleton count={5} />
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
                  <span className="text-xs text-zinc-500">{formatFileSize(asset.file_size)}</span>
                </div>

                <div>
                  <p className="truncate text-sm font-medium text-zinc-100">
                    {(asset.metadata_json?.original_filename as string) || asset.id}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">ID: {asset.id}</p>
                  {typeof asset.metadata_json?.step === "string" && (
                    <p className="mt-1 text-xs text-zinc-600">步骤: {asset.metadata_json.step}</p>
                  )}
                </div>

                {asset.mime_type ? (
                  <p className="truncate text-xs text-zinc-500">{asset.mime_type}</p>
                ) : null}

                <div className="flex items-center gap-2">
                  {asset.metadata_json?.object_name ? (
                    <a
                      href={getAssetServeUrl(asset.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-xs text-violet-400 hover:underline"
                    >
                      打开资源
                    </a>
                  ) : isMockUri(asset.uri) ? (
                    <span className="text-xs text-zinc-600">模拟数据，无文件</span>
                  ) : asset.uri ? (
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
                    onClick={() => onPreview(asset)}
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
  );
}
