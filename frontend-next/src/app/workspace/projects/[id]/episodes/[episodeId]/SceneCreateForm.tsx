"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GlassSurface, GlassButton, GlassInput } from "@/components/ui/primitives";
import { apiClient } from "@/lib/api-client";

interface SceneCreateFormProps {
  episodeId: string;
}

export function SceneCreateForm({ episodeId }: SceneCreateFormProps) {
  const router = useRouter();
  const [sceneNo, setSceneNo] = useState<number>(1);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await apiClient.createScene({
        episode_id: episodeId,
        scene_no: sceneNo,
        title: title || undefined,
        status: "DRAFT",
      });

      setSuccess(true);
      setSceneNo(sceneNo + 1);
      setTitle("");

      // 使用 router.refresh() 重新获取服务端数据，避免整页刷新
      setTimeout(() => {
        router.refresh();
      }, 1000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "创建场景失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassSurface variant="elevated" className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-zinc-100">创建新场景</h3>
        {success && (
          <span className="text-sm text-green-400">✓ 创建成功</span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-zinc-500 mb-1">场景序号</label>
          <GlassInput
            type="number"
            min="1"
            value={sceneNo}
            onChange={(e) => setSceneNo(parseInt(e.target.value) || 1)}
            disabled={loading}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-xs text-zinc-500 mb-1">场景标题（可选）</label>
          <GlassInput
            type="text"
            placeholder="例如：开场镜头"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={loading}
            className="w-full"
          />
        </div>

        {error && (
          <div className="text-sm text-red-400">{error}</div>
        )}

        <GlassButton
          type="submit"
          variant="primary"
          loading={loading}
          className="w-full"
        >
          创建场景
        </GlassButton>
      </form>
    </GlassSurface>
  );
}
