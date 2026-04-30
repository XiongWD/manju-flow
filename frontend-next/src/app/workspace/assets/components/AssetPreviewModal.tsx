"use client";

import { useState, useEffect, useCallback } from "react";
import GlassModalShell from "@/components/ui/primitives/GlassModalShell";
import { type Asset } from "@/lib/api-client";
import { formatFileSize, getAssetTypeLabel, getAssetTypeColor, inferAssetType, getAssetServeUrl, isMockUri } from "./types";

interface AssetPreviewModalProps {
  asset: Asset | null;
  onClose: () => void;
}

export default function AssetPreviewModal({ asset, onClose }: AssetPreviewModalProps) {
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

  const resetPreviewState = useCallback(() => {
    setPreviewUrl(null); setPreviewText(null); setPreviewError(null);
    setImagePreviewMode("fit"); setImageZoom(100); setImageOffset({ x: 0, y: 0 });
    setDraggingImage(false); setDragStart(null); setVideoMeta({});
  }, []);

  const _isMockUri = useCallback((uri?: string | null) => isMockUri(uri), []);

  useEffect(() => {
    const loadPreview = async () => {
      if (!asset) { setPreviewUrl(null); setPreviewText(null); setPreviewError(null); return; }
      try {
        setPreviewLoading(true); setPreviewError(null); setPreviewText(null);
        if (isMockUri(asset.uri) && !asset.metadata_json?.object_name) {
          setPreviewError("该资产为模拟数据，无实际文件可供预览"); setPreviewLoading(false); return;
        }
        const serveUrl = getAssetServeUrl(asset.id);
        setPreviewUrl(serveUrl);
        const previewKind = inferAssetType(asset.mime_type, (asset.metadata_json?.original_filename as string) || serveUrl, asset.type);
        if (previewKind === "document") {
          const text = await fetch(serveUrl).then((r) => { if (!r.ok) throw new Error(`文本预览失败: ${r.status}`); return r.text(); });
          setPreviewText(text);
        }
      } catch (error) {
        console.error("加载预览失败:", error);
        setPreviewError(error instanceof Error ? error.message : "预览加载失败");
      } finally { setPreviewLoading(false); }
    };
    void loadPreview();
  }, [asset, _isMockUri]);

  // Determine if this should be fullscreen image preview instead
  if (!asset) return null;
  const filename = (asset.metadata_json?.original_filename as string) || "";
  const previewKind = inferAssetType(asset.mime_type, filename || previewUrl || "", asset.type);
  const isFullscreenImage = previewKind === "image" && !!previewUrl && !previewLoading && !previewError;

  return (
    <>
      <GlassModalShell
        open={!!asset && !isFullscreenImage}
        onClose={() => { resetPreviewState(); onClose(); }}
        closeOnEsc={false}
        title={filename || asset.id || "预览"}
        size="lg"
      >
        {asset && (
          <div className="space-y-4">
            <div className="space-y-2 text-sm text-zinc-300">
              <div className="flex items-center gap-4">
                <span className="text-zinc-500">类型:</span>
                <span className="rounded px-2 py-1 text-xs font-medium" style={{ backgroundColor: `${getAssetTypeColor(asset.type)}20`, color: getAssetTypeColor(asset.type) }}>
                  {getAssetTypeLabel(asset.type)}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-zinc-500">大小:</span>
                <span>{formatFileSize(asset.file_size)}</span>
              </div>
              {asset.mime_type && (
                <div className="flex items-center gap-4">
                  <span className="text-zinc-500">MIME:</span>
                  <span className="truncate text-xs">{asset.mime_type}</span>
                </div>
              )}
              {asset.duration && (
                <div className="flex items-center gap-4">
                  <span className="text-zinc-500">时长:</span>
                  <span>{(asset.duration / 60).toFixed(1)} 秒</span>
                </div>
              )}
              {asset.width && asset.height && (
                <div className="flex items-center gap-4">
                  <span className="text-zinc-500">尺寸:</span>
                  <span>{asset.width} × {asset.height}</span>
                </div>
              )}
            </div>

            {previewKind === "image" && (
              <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300">
                <div className="flex items-center gap-2">
                  <span>图片预览</span>
                  <span className="text-zinc-500">{asset.width && asset.height ? `${asset.width} × ${asset.height}` : "原始尺寸信息缺失"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500">缩放 {imageZoom}%</span>
                  <button type="button" onClick={() => { setImagePreviewMode("fit"); setImageZoom(100); setImageOffset({ x: 0, y: 0 }); }} className={`rounded px-2 py-1 ${imagePreviewMode === "fit" ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-300"}`}>适配窗口</button>
                  <button type="button" onClick={() => { setImagePreviewMode("full"); setImageZoom(100); setImageOffset({ x: 0, y: 0 }); }} className={`rounded px-2 py-1 ${imagePreviewMode === "full" ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-300"}`}>原始尺寸</button>
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
                  if (previewKind !== "image") return;
                  e.preventDefault(); e.stopPropagation();
                  setImagePreviewMode("full");
                  setImageZoom((z) => {
                    const next = Math.max(25, Math.min(400, z + (e.deltaY < 0 ? 12 : -12)));
                    if (next <= 100) setImageOffset({ x: 0, y: 0 });
                    return next;
                  });
                }}
              >
                {previewKind === "image" ? (
                  <img
                    src={previewUrl}
                    alt={filename || "预览"}
                    onDoubleClick={() => { setImagePreviewMode("full"); setImageZoom((z) => (z === 100 ? 200 : 100)); }}
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
                ) : previewKind === "video" ? (
                  <div className="w-full space-y-3">
                    <video
                      src={previewUrl}
                      controls
                      className="max-h-[60vh] w-full rounded-md bg-black"
                      onLoadedMetadata={(e) => {
                        const el = e.currentTarget;
                        const bitrateKbps = asset.file_size && el.duration > 0 ? Math.round((asset.file_size * 8) / el.duration / 1000) : undefined;
                        setVideoMeta({ duration: el.duration, width: el.videoWidth, height: el.videoHeight, bitrateKbps });
                      }}
                    >您的浏览器不支持视频播放</video>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                      {(videoMeta.width && videoMeta.height) || (asset.width && asset.height) ? <span>分辨率: {videoMeta.width || asset.width} × {videoMeta.height || asset.height}</span> : null}
                      {asset.file_size ? <span>大小: {formatFileSize(asset.file_size)}</span> : null}
                      {videoMeta.duration ? <span>时长: {videoMeta.duration.toFixed(1)} 秒</span> : null}
                      {videoMeta.bitrateKbps ? <span>码率: {videoMeta.bitrateKbps} kbps</span> : null}
                      <span>当前为原文件预览，未做前端压缩</span>
                    </div>
                  </div>
                ) : previewKind === "audio" ? (
                  <audio src={previewUrl} controls className="w-full">您的浏览器不支持音频播放</audio>
                ) : previewText !== null ? (
                  <pre className="max-h-[60vh] w-full overflow-auto whitespace-pre-wrap rounded-md bg-zinc-950 p-4 text-left text-xs text-zinc-200">{previewText}</pre>
                ) : (
                  <div className="space-y-3 text-center">
                    <p className="text-sm text-zinc-400">该文件类型暂不支持在线预览</p>
                    <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="inline-block rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700">打开文件</a>
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
                <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="rounded-md bg-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-600">
                  下载 / 打开原文件
                </a>
              </div>
            )}
          </div>
        )}
      </GlassModalShell>
    </>
  );
}
