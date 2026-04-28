import { Suspense } from "react";
import Link from "next/link";
import { GlassSurface } from "@/components/ui/primitives";
import { apiClient, Project, Episode } from "@/lib/api-client";
import { EpisodeListManager } from '@/components/workspace/EpisodeListManager'

const GENRE_MAP: Record<string, string> = {
  Revenge: '复仇',
  Werewolf: '狼人',
  Mafia: '黑帮',
  CEO: '霸总',
  Romance: '言情',
  Fantasy: '奇幻',
  Thriller: '悬疑',
  Custom: '自定义',
}

const normalizeRegion = (value?: string) => value === 'US' ? 'USA' : value
const statusLabel = (value?: string) => {
  if (value === 'in_production') return '制作中'
  if (value === 'active') return '运行中'
  if (value === 'completed') return '已完成'
  if (value === 'archived') return '已归档'
  return value || '—'
}

export const dynamic = 'force-dynamic';

async function ProjectDetail({ projectId }: { projectId: string }) {
  const project = await apiClient.get<Project>(`projects/${projectId}`);
  const episodes = await apiClient.get<Episode[]>(
    `episodes/?project_id=${projectId}`
  );

  return (
    <div className="space-y-6">
      {/* Project Info */}
      <GlassSurface variant="elevated" className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-zinc-100 mb-2">
              {project.name}
            </h2>
            <p className="text-zinc-400">{project.description}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/workspace/projects?edit=${project.id}`} className="rounded-md border border-zinc-700 bg-zinc-800/70 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-700 transition-colors">✏️ 编辑项目</Link>
            <span
              className={`text-sm px-3 py-1 rounded-full ${
                project.status === "in_production"
                  ? "bg-green-900/30 text-green-400"
                  : "bg-zinc-800 text-zinc-400"
              }`}
            >
              {statusLabel(project.status)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-zinc-800/50">
          <div>
            <div className="text-xs text-zinc-500 mb-1">题材</div>
            <div className="text-sm text-zinc-200">{project.genre ? (GENRE_MAP[project.genre] || project.genre) : '—'}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500 mb-1">平台</div>
            <div className="text-sm text-zinc-200">{project.platform || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500 mb-1">地区</div>
            <div className="text-sm text-zinc-200">{normalizeRegion(project.market) || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500 mb-1">等级</div>
            <div className="text-sm text-zinc-200">{project.tier}</div>
          </div>
        </div>
      </GlassSurface>

      {/* Episodes List */}
      <EpisodeListManager projectId={projectId} episodes={episodes} />
    </div>
  );
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          href="/workspace/projects"
          className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          ← 返回项目列表
        </Link>
      </div>

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <div className="text-zinc-500">加载中...</div>
          </div>
        }
      >
        <ProjectDetail projectId={id} />
      </Suspense>
    </div>
  );
}
