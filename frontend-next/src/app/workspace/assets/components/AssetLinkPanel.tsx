"use client";

import { useState } from "react";
import GlassSurface from "@/components/ui/primitives/GlassSurface";
import { apiClient } from "@/lib/api-client";

export default function AssetLinkPanel() {
  const [linking, setLinking] = useState(false);
  const [linkMessage, setLinkMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [linkAssetId, setLinkAssetId] = useState("");
  const [linkOwnerType, setLinkOwnerType] = useState("");
  const [linkOwnerId, setLinkOwnerId] = useState("");

  const handleCreateLink = async () => {
    if (!linkAssetId || !linkOwnerType || !linkOwnerId) {
      setLinkMessage({ type: "error", text: "请填写所有字段" });
      return;
    }
    try {
      setLinking(true); setLinkMessage(null);
      await apiClient.createAssetLink(linkAssetId, { owner_type: linkOwnerType, owner_id: linkOwnerId });
      setLinkMessage({ type: "success", text: "关联创建成功" });
      setLinkAssetId(""); setLinkOwnerType(""); setLinkOwnerId("");
    } catch (error) {
      console.error("关联创建失败:", error);
      setLinkMessage({ type: "error", text: error instanceof Error ? error.message : "关联创建失败" });
    } finally { setLinking(false); }
  };

  return (
    <GlassSurface variant="panel" padded>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">关联资产</h2>
      </div>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label htmlFor="link-asset-id" className="mb-1 block text-xs text-zinc-400">资产 ID</label>
            <input id="link-asset-id" type="text" value={linkAssetId} onChange={(e) => setLinkAssetId(e.target.value)} disabled={linking} placeholder="输入资产 ID" className="w-full rounded-md bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50" />
          </div>
          <div>
            <label htmlFor="link-owner-type" className="mb-1 block text-xs text-zinc-400">归属类型 (owner_type)</label>
            <input id="link-owner-type" type="text" value={linkOwnerType} onChange={(e) => setLinkOwnerType(e.target.value)} disabled={linking} placeholder="例如: project, episode" className="w-full rounded-md bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50" />
          </div>
          <div>
            <label htmlFor="link-owner-id" className="mb-1 block text-xs text-zinc-400">归属对象 ID (owner_id)</label>
            <input id="link-owner-id" type="text" value={linkOwnerId} onChange={(e) => setLinkOwnerId(e.target.value)} disabled={linking} placeholder="输入对象 ID" className="w-full rounded-md bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50" />
          </div>
        </div>
        <button onClick={handleCreateLink} disabled={!linkAssetId || !linkOwnerType || !linkOwnerId || linking} className="self-start rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:bg-violet-600/50 disabled:opacity-50">
          {linking ? "关联中..." : "创建关联"}
        </button>
        {linkMessage && (
          <p className={`text-sm ${linkMessage.type === "success" ? "text-green-400" : "text-red-400"}`}>{linkMessage.text}</p>
        )}
      </div>
    </GlassSurface>
  );
}
