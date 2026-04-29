"use client";

import { useState } from "react";
import { GlassSurface, GlassChip, GlassButton } from "@/components/ui/primitives";
import type { Asset } from "@/lib/api-client";

// Props for the component
interface AudioAssetsPanelProps {
  audioAssets?: {
    voice_assets: Asset[];
    bgm_assets: Asset[];
    mixed_audio_assets: Asset[];
  };
  qaEvidenceAssets?: {
    evidence_assets: Asset[];
    detection_json_assets: Asset[];
  };
  loading?: boolean;
  error?: string | null;
}

// 格式化时间显示
function formatTimeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "刚刚";
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return date.toLocaleDateString('zh-CN');
}

// 获取资产类型显示名称
function getAssetTypeDisplayName(type: string): string {
  const typeMap: Record<string, string> = {
    'voice': '语音',
    'bgm': '背景乐',
    'mixed_audio': '混音',
    'audio': '音频',
    'qa_evidence': 'QA证据',
    'detection_json': '检测报告',
  };
  return typeMap[type] || type;
}

// 单个资产卡片
function AssetCard({ asset, category }: { asset: Asset; category: string }) {
  const assetTypeName = getAssetTypeDisplayName(asset.type);
  
  return (
    <div className="flex items-center justify-between p-2 bg-zinc-900/30 rounded border border-zinc-800/50">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <GlassChip tone="neutral" className="text-xs shrink-0">
          {assetTypeName}
        </GlassChip>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-zinc-300 truncate" title={asset.id}>
            #{asset.id.slice(0, 8)}
          </div>
          <div className="text-xs text-zinc-500">
            {formatTimeAgo(asset.created_at)}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {asset.uri ? (
          <a
            href={asset.uri}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-violet-400 hover:underline"
          >
            打开
          </a>
        ) : (
          <span className="text-xs text-zinc-600">无链接</span>
        )}
      </div>
    </div>
  );
}

// 资产类别卡片
function AssetCategoryCard({
  title,
  assets,
  category,
  tone = 'neutral'
}: {
  title: string;
  assets: Asset[];
  category: string;
  tone?: 'neutral' | 'info' | 'success' | 'warning';
}) {
  if (assets.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500 font-medium">{title}</span>
        <GlassChip tone={tone} className="text-xs">
          {assets.length}
        </GlassChip>
      </div>
      <div className="space-y-1">
        {assets.slice(0, 3).map((asset) => (
          <AssetCard key={asset.id} asset={asset} category={category} />
        ))}
        {assets.length > 3 && (
          <div className="text-xs text-zinc-600 text-center py-1">
            还有 {assets.length - 3} 个...
          </div>
        )}
      </div>
    </div>
  );
}

export function AudioAssetsPanel({ audioAssets, qaEvidenceAssets, loading, error }: AudioAssetsPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const hasAudioAssets = audioAssets && (
    audioAssets.voice_assets.length > 0 ||
    audioAssets.bgm_assets.length > 0 ||
    audioAssets.mixed_audio_assets.length > 0
  );

  const hasQAEvidence = qaEvidenceAssets && (
    qaEvidenceAssets.evidence_assets.length > 0 ||
    qaEvidenceAssets.detection_json_assets.length > 0
  );

  if (loading) {
    return (
      <GlassSurface variant="elevated" className="p-4">
        <div className="text-sm text-zinc-500">加载资产信息...</div>
      </GlassSurface>
    );
  }

  if (error) {
    return (
      <GlassSurface variant="elevated" className="p-4">
        <div className="text-sm text-red-400">加载资产信息失败</div>
      </GlassSurface>
    );
  }

  if (!hasAudioAssets && !hasQAEvidence) {
    return (
      <GlassSurface variant="elevated" className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-zinc-200">资产预览</span>
          <GlassChip tone="info" className="text-xs">
            040b
          </GlassChip>
        </div>
        <div className="text-xs text-zinc-600">暂无资产数据</div>
      </GlassSurface>
    );
  }

  return (
    <GlassSurface variant="elevated" className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-200">资产预览</span>
          <GlassChip tone="info" className="text-xs">
            040b
          </GlassChip>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-zinc-500 hover:text-zinc-300 transition-colors text-xs"
        >
          {expanded ? '收起' : '展开'}
        </button>
      </div>

      {expanded && (
        <div className="space-y-4">
          {/* 音频资产 */}
          {hasAudioAssets && (
            <div className="space-y-2">
              <div className="text-xs text-zinc-500 mb-2 font-medium">音频资产</div>
              <div className="grid grid-cols-3 gap-3">
                <AssetCategoryCard
                  title="语音"
                  assets={audioAssets?.voice_assets || []}
                  category="voice"
                  tone="info"
                />
                <AssetCategoryCard
                  title="背景乐"
                  assets={audioAssets?.bgm_assets || []}
                  category="bgm"
                  tone="success"
                />
                <AssetCategoryCard
                  title="混音"
                  assets={audioAssets?.mixed_audio_assets || []}
                  category="mixed_audio"
                  tone="warning"
                />
              </div>
            </div>
          )}

          {/* QA 证据 */}
          {hasQAEvidence && (
            <div className="pt-3 border-t border-zinc-800/50">
              <div className="text-xs text-zinc-500 mb-2 font-medium">QA 证据</div>
              <div className="grid grid-cols-2 gap-3">
                <AssetCategoryCard
                  title="证据文件"
                  assets={qaEvidenceAssets?.evidence_assets || []}
                  category="qa_evidence"
                  tone="neutral"
                />
                <AssetCategoryCard
                  title="检测报告"
                  assets={qaEvidenceAssets?.detection_json_assets || []}
                  category="detection_json"
                  tone="neutral"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </GlassSurface>
  );
}