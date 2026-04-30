"use client";

import GlassSurface from "@/components/ui/primitives/GlassSurface";
import GlassButton from "@/components/ui/primitives/GlassButton";
import GlassChip from "@/components/ui/primitives/GlassChip";
import { type DeliveryPackage } from "@/lib/api-client";
import { statusTone, statusLabel, shortId } from "./helpers";

const PACKAGE_TYPE_LABELS: Record<DeliveryPackage["package_type"], string> = {
  video: "视频",
  audio: "音频",
  subtitle: "字幕",
  bundle: "完整包",
};

interface DeliveryPackagesPanelProps {
  selectedEpisodeId: string;
  packages: DeliveryPackage[];
  loading: boolean;
  onCreatePackage: (packageType: DeliveryPackage["package_type"]) => void;
}

export default function DeliveryPackagesPanel({
  selectedEpisodeId,
  packages,
  loading,
  onCreatePackage,
}: DeliveryPackagesPanelProps) {
  return (
    <GlassSurface variant="panel">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">交付包</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            按剧集维度生成不同用途的交付包：
            <strong className="text-zinc-400">视频</strong>（剪辑成品，含画面+字幕）、
            <strong className="text-zinc-400">音频</strong>（独立音轨）、
            <strong className="text-zinc-400">字幕</strong>（SRT 文件）、
            <strong className="text-zinc-400">完整包</strong>
            （视频+音频+字幕+元数据，用于审片或归档）。生成过程异步执行，状态可在此跟踪。
          </p>
        </div>
        {selectedEpisodeId && (
          <div className="flex gap-2">
            {(["video", "audio", "subtitle", "bundle"] as const).map((t) => (
              <GlassButton key={t} variant="secondary" size="sm" onClick={() => onCreatePackage(t)}>
                {PACKAGE_TYPE_LABELS[t]}
              </GlassButton>
            ))}
          </div>
        )}
      </div>

      {!selectedEpisodeId ? (
        <p className="text-zinc-500 text-sm py-4 text-center">请先选择剧集</p>
      ) : loading ? (
        <p className="text-zinc-500 text-sm py-4 text-center">加载中…</p>
      ) : packages.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-zinc-500 text-sm">暂无交付包。点击上方按钮为当前剧集生成第一个交付包。</p>
          <p className="text-zinc-600 text-xs mt-1">
            提示：确保该剧集下的场景已完成渲染并通过质检，否则生成的包可能不完整。
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-zinc-400">
                <th className="pb-2 pr-4 font-medium">类型</th>
                <th className="pb-2 pr-4 font-medium">状态</th>
                <th className="pb-2 pr-4 font-medium">大小</th>
                <th className="pb-2 pr-4 font-medium">创建时间</th>
                <th className="pb-2 font-medium">ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {packages.map((pkg) => (
                <tr key={pkg.id} className="hover:bg-white/[0.02]">
                  <td className="py-2.5 pr-4 text-zinc-200">{PACKAGE_TYPE_LABELS[pkg.package_type]}</td>
                  <td className="py-2.5 pr-4">
                    <GlassChip tone={statusTone(pkg.status)}>{statusLabel(pkg.status)}</GlassChip>
                  </td>
                  <td className="py-2.5 pr-4 text-zinc-400 tabular-nums">
                    {pkg.file_size ? `${(pkg.file_size / 1024 / 1024).toFixed(1)} MB` : "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-zinc-400">
                    {new Date(pkg.created_at).toLocaleString("zh-CN", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="py-2.5 text-zinc-500 text-xs font-mono">{shortId(pkg.id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassSurface>
  );
}
