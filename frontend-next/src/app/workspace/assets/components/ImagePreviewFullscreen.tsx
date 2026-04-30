"use client";

import { useState, useCallback } from "react";
import { type Asset } from "@/lib/api-client";
import { inferAssetType, getAssetServeUrl, isMockUri } from "./types";

interface ImagePreviewFullscreenProps {
  asset: Asset;
  previewUrl: string;
  onClose: () => void;
}

export default function ImagePreviewFullscreen({ asset, previewUrl, onClose }: ImagePreviewFullscreenProps) {
  const [imageZoom, setImageZoom] = useState(100);
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const [draggingImage, setDraggingImage] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; originX: number; originY: number } | null>(null);

  const filename = (asset.metadata_json?.original_filename as string) || "预览";

  return (
    <div
      className="fixed inset-0 z-[140] bg-black/92"
      onWheelCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
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
        <button type="button" onClick={() => { setImageZoom((z) => Math.max(25, z - 25)); if (imageZoom <= 125) setImageOffset({ x: 0, y: 0 }); }} className="rounded bg-white/10 px-3 py-1.5 text-base font-semibold">−</button>
        <button type="button" onClick={() => { setImageZoom((z) => Math.min(400, z + 25)); }} className="rounded bg-white/10 px-3 py-1.5 text-base font-semibold">+</button>
        <button type="button" onClick={() => { setImageZoom(100); setImageOffset({ x: 0, y: 0 }); }} className="rounded bg-white/10 px-3 py-1.5">重置</button>
        <button type="button" onClick={onClose} className="rounded bg-amber-500/80 px-3 py-1.5 font-medium text-white">退出预览</button>
      </div>
      <button type="button" onClick={onClose} className="absolute right-4 top-4 z-[150] rounded-full bg-black/50 px-3 py-2 text-sm text-white">关闭</button>
      <div className="flex h-full w-full items-center justify-center overflow-hidden p-6">
        <img
          src={previewUrl}
          alt={filename}
          onDoubleClick={() => { setImageZoom((z) => (z === 100 ? 200 : 100)); }}
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
  );
}
