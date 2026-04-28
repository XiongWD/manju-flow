import { Suspense } from "react";
import Link from "next/link";
import { GlassSurface, GlassChip } from "@/components/ui/primitives";
import { apiClient, EpisodeWithScenes, AssetWithLinks } from "@/lib/api-client";
import { SceneList } from "./SceneList";
import { SceneCreateForm } from "./SceneCreateForm";

export const dynamic = 'force-dynamic';

async function EpisodeDetail({
  episodeId,
}: {
  projectId: string;
  episodeId: string;
}) {
  const episode = await apiClient.get<EpisodeWithScenes>(`episodes/${episodeId}`);

  if (!episode) {
    return (
      <GlassSurface variant="elevated" className="p-6">
        <p className="text-zinc-400">剧集未找到</p>
      </GlassSurface>
    );
  }

  // 获取当前剪辑版详情（如果有）
  let currentCutAsset: AssetWithLinks | null = null;
  if (episode.current_cut_asset_id) {
    try {
      currentCutAsset = await apiClient.getAsset(episode.current_cut_asset_id);
    } catch {
      // asset 可能不存在，忽略错误
    }
  }

  return (
    <EpisodeDetailContent episode={episode} currentCutAsset={currentCutAsset} />
  );
}

function EpisodeDetailContent({ episode, currentCutAsset }: { episode: EpisodeWithScenes; currentCutAsset: AssetWithLinks | null }) {
  const scenes = episode.scenes || [];

  // 从 asset_id 中提取简短标识（取前 8 位）
  const currentCutAssetShort = episode.current_cut_asset_id
    ? `#${episode.current_cut_asset_id.slice(0, 8)}`
    : null;

  // 格式化时间显示
  const formatTimeAgo = (dateStr: string) => {
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
  };

  // 获取类型显示名称
  const getTypeDisplayName = (type: string) => {
    const typeMap: Record<string, string> = {
      'video': '视频',
      'audio': '音频',
      'image': '图片',
      'document': '文档',
      'subtitle': '字幕',
    };
    return typeMap[type] || type;
  };

  return (
    <div className="space-y-6">
      {/* Episode Info */}
      <GlassSurface variant="elevated" className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-zinc-100 mb-2">
              {episode.title}
            </h2>
            <p className="text-sm text-zinc-500">第 {episode.episode_no} 集</p>
          </div>
          <span
            className={`text-sm px-3 py-1 rounded-full ${
              episode.status === "IN_PRODUCTION"
                ? "bg-blue-900/30 text-blue-400"
                : "bg-zinc-800 text-zinc-400"
            }`}
          >
            {episode.status}
          </span>
        </div>

        {/* 当前剪辑版（只读展示） */}
        {currentCutAssetShort && (
          <div className="mt-4 pt-4 border-t border-zinc-800/50">
            <div className="text-xs text-zinc-500 mb-2">当前剪辑版</div>
            <div className="flex items-center gap-2 flex-wrap">
              <GlassChip tone="success" className="text-xs">
                {currentCutAssetShort}
              </GlassChip>
              {currentCutAsset && (
                <>
                  <GlassChip tone="neutral" className="text-xs text-zinc-400">
                    {getTypeDisplayName(currentCutAsset.type)}
                  </GlassChip>
                  <span className="text-xs text-zinc-500">
                    {formatTimeAgo(currentCutAsset.created_at)}
                  </span>
                  {currentCutAsset.uri ? (
                    <a
                      href={currentCutAsset.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-xs text-violet-400 hover:underline"
                    >
                      打开资源
                    </a>
                  ) : (
                    <span className="text-xs text-zinc-600">无可访问链接</span>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {episode.outline && (
          <div className="mt-4 pt-4 border-t border-zinc-800/50">
            <div className="text-xs text-zinc-500 mb-2">剧情大纲</div>
            <p className="text-sm text-zinc-300">{episode.outline}</p>
          </div>
        )}

        {episode.script && (
          <div className="mt-4 pt-4 border-t border-zinc-800/50">
            <div className="text-xs text-zinc-500 mb-2">剧本内容</div>
            <p className="text-sm text-zinc-300 whitespace-pre-wrap">
              {episode.script}
            </p>
          </div>
        )}

        {/* Task center 占位入口 */}
        <div className="mt-6 pt-4 border-t border-zinc-800/50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">Task center</span>
            <GlassChip tone="neutral" className="text-xs text-zinc-500">
              待补强
            </GlassChip>
          </div>
          <p className="text-xs text-zinc-600 mt-2">后续开放：统一任务管理与工作台视图，集中监控项目执行状态</p>
        </div>

        {/* Shot preparation 占位入口 */}
        <div className="mt-6 pt-4 border-t border-zinc-800/50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">Shot preparation</span>
            <GlassChip tone="neutral" className="text-xs text-zinc-500">
              待补强
            </GlassChip>
          </div>
          <p className="text-xs text-zinc-600 mt-2">后续开放：统一入口管理场景的前期准备工作与任务流程</p>
        </div>

        {/* 发布功能占位入口 */}
        <div className="mt-6 pt-4 border-t border-zinc-800/50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">发布功能</span>
            <GlassChip tone="neutral" className="text-xs text-zinc-500">
              待后端接通
            </GlassChip>
          </div>
          <p className="text-xs text-zinc-600 mt-2">发布模块暂未开放，敬请期待</p>
        </div>
      </GlassSurface>

      {/* Create Scene Form */}
      <SceneCreateForm episodeId={episode.id} />

      {/* Scenes List */}
      <SceneList scenes={scenes} projectId={episode.project_id} episodeId={episode.id} />
    </div>
  );
}

export default async function EpisodeDetailPage({
  params,
}: {
  params: Promise<{ id: string; episodeId: string }>;
}) {
  const { id, episodeId } = await params;

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          href={`/workspace/projects/${id}`}
          className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          ← 返回项目详情
        </Link>
      </div>

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <div className="text-zinc-500">加载中...</div>
          </div>
        }
      >
        <EpisodeDetail projectId={id} episodeId={episodeId} />
      </Suspense>
    </div>
  );
}
