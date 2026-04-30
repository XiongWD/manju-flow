"use client";

import { useState } from "react";
import GlassSurface from "@/components/ui/primitives/GlassSurface";
import { apiClient, type UploadResponse } from "@/lib/api-client";
import { inferAssetType, formatFileSize } from "./types";

interface AssetUploadPanelProps {
  projectId?: string;
  onUploaded: () => void;
}

export default function AssetUploadPanel({ projectId, onUploaded }: AssetUploadPanelProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setSelectedFile(file); setUploadMessage(null); }
  };

  const handleUpload = async () => {
    if (!selectedFile) { setUploadMessage({ type: "error", text: "请先选择文件" }); return; }
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("asset_type", inferAssetType(selectedFile.type));
    if (projectId) formData.append("project_id", projectId);
    try {
      setUploading(true);
      const result: UploadResponse = await apiClient.uploadFile(formData);
      setUploadMessage({ type: "success", text: `上传成功: ${result.message}` });
      setSelectedFile(null);
      const fileInput = document.getElementById("file-upload") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      onUploaded();
    } catch (error) {
      console.error("上传失败:", error);
      setUploadMessage({ type: "error", text: error instanceof Error ? error.message : "上传失败" });
    } finally { setUploading(false); }
  };

  return (
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
          <p className="text-xs text-zinc-400">已选择: {selectedFile.name} ({formatFileSize(selectedFile.size)})</p>
        )}
        {uploadMessage && (
          <p className={`text-sm ${uploadMessage.type === "success" ? "text-green-400" : "text-red-400"}`}>
            {uploadMessage.text}
          </p>
        )}
      </div>
    </GlassSurface>
  );
}
