"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FolderKanban,
  Plus,
  ArrowRight,
  Zap,
  Layers,
} from "lucide-react";
import GlassSurface from "@/components/ui/primitives/GlassSurface";
import GlassChip from "@/components/ui/primitives/GlassChip";
import { PageHeader } from "@/components/workspace/PageHeader";
import { apiClient } from "@/lib/api-client";
import type { Project } from "@/lib/api-client";

/** 状态配置 */
const statusConfig: Record<string, { label: string; color: string }> = {
  active: { label: "活跃", color: "#22C55E" },
  in_production: { label: "制作中", color: "#F59E0B" },
  completed: { label: "已完成", color: "#06B6D4" },
  archived: { label: "已归档", color: "#767D88" },
  DRAFT: { label: "草稿", color: "#767D88" },
};

export default function WorkspacePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .listProjects()
      .then((data) => {
        setProjects(data.items);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Failed to load projects:", error);
        setLoading(false);
      });
  }, []);

  const recentProjects = projects.slice(0, 5);
  const activeCount = projects.filter(
    (p) => p.status === "active" || p.status === "in_production"
  ).length;
  const completedCount = projects.filter(
    (p) => p.status === "completed"
  ).length;

  return (
    <div className="p-6 md:p-8 space-y-12">
      <div>
        <div className="flex items-start justify-between gap-6">
          <div className="max-w-lg">
            <PageHeader title="制作线总览" description="当前项目进度、渲染队列和质检状态集中在此。" />
          </div>
          {/* 右侧状态摘要块 — 紧凑但清晰 */}
          <GlassSurface
            variant="panel"
            className="min-w-[180px] shrink-0 hidden sm:block"
          >
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
              Production Status
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">项目总数</span>
                <span className="font-mono text-base font-semibold text-zinc-100">
                  {projects.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">制作中</span>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <span className="font-mono text-base font-semibold text-zinc-100">
                    {activeCount}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">已完成</span>
                <span className="font-mono text-base font-semibold text-zinc-100">
                  {completedCount}
                </span>
              </div>
            </div>
          </GlassSurface>
        </div>
      </div>

      {/* ── 快速操作 — 非对称布局 (2大 + 1宽) ── */}
      <div>
        <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">
          快捷操作
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* 大卡 1: 最近项目 */}
          <Link
            href="/workspace/projects"
            className="group"
          >
            <GlassSurface variant="panel" interactive className="p-5 flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 shrink-0">
                <FolderKanban className="h-[18px] w-[18px] text-zinc-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-zinc-100">全部项目</div>
                <div className="mt-0.5 text-xs text-zinc-500">{projects.length} 个</div>
              </div>
              <ArrowRight className="h-4 w-4 text-zinc-700 group-hover:text-zinc-500 transition-all duration-200 group-hover:translate-x-0.5 shrink-0" />
            </GlassSurface>
          </Link>

          {/* 大卡 2: 新建项目 */}
          <Link
            href="/workspace/projects"
            className="group"
          >
            <GlassSurface variant="panel" interactive className="p-5 flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-900/30 shrink-0">
                <Plus className="h-[18px] w-[18px] text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-zinc-100">新建项目</div>
                <div className="mt-0.5 text-xs text-zinc-500">创建制作项目</div>
              </div>
              <ArrowRight className="h-4 w-4 text-zinc-700 group-hover:text-zinc-500 transition-all duration-200 group-hover:translate-x-0.5 shrink-0" />
            </GlassSurface>
          </Link>

          {/* 宽卡: 渲染队列 + QA 并排 */}
          <div className="col-span-1 sm:col-span-2 grid grid-cols-2 gap-3">
            <Link
              href="/workspace/render"
              className="group"
            >
              <GlassSurface variant="panel" interactive className="p-4 flex items-center gap-3.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 shrink-0">
                  <Zap className="h-4 w-4 text-zinc-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-zinc-100">渲染队列</div>
                </div>
              </GlassSurface>
            </Link>
            <Link
              href="/workspace/qa"
              className="group"
            >
              <GlassSurface variant="panel" interactive className="p-4 flex items-center gap-3.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 shrink-0">
                  <Layers className="h-4 w-4 text-zinc-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-zinc-100">QA 中心</div>
                </div>
              </GlassSurface>
            </Link>
          </div>
        </div>
      </div>

      {/* ── 当前 Slate — 项目进度 ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            Current Slate
          </div>
          <Link
            href="/workspace/projects"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors duration-200 flex items-center gap-1"
          >
            查看全部 <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-zinc-500">加载中...</div>
          </div>
        ) : recentProjects.length === 0 ? (
          <GlassSurface variant="panel" className="flex flex-col items-center justify-center py-20">
            <FolderKanban className="h-8 w-8 text-zinc-800 mb-3" />
            <span className="text-base text-zinc-500">暂无项目</span>
            <span className="text-xs text-zinc-600 mt-1">创建你的第一个制作项目</span>
          </GlassSurface>
        ) : (
          <div className="space-y-2">
            {recentProjects.map((project) => {
              const sc = statusConfig[project.status] || { label: project.status, color: "#767D88" };
              return (
                <Link
                  key={project.id}
                  href={`/workspace/projects/${project.id}`}
                  className="group block"
                >
                  <GlassSurface
                    variant="panel"
                    interactive
                    className="flex items-center justify-between px-6 py-4"
                  >
                    <div className="flex items-center gap-5 min-w-0">
                      {/* 状态色条 */}
                      <span
                        className="block h-8 w-[3px] rounded-full shrink-0"
                        style={{ backgroundColor: sc.color }}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-zinc-100 truncate">
                          {project.name}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
                          {project.genre && <span>{project.genre}</span>}
                          {project.market && (
                            <>
                              <span className="text-zinc-800">·</span>
                              <span>{project.market}</span>
                            </>
                          )}
                          {project.tier && (
                            <>
                              <span className="text-zinc-800">·</span>
                              <span className="font-mono text-[11px] uppercase text-zinc-500">
                                Tier {project.tier}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <GlassChip
                        tone={
                          sc.label === "活跃" || sc.label === "已完成"
                            ? "success"
                            : sc.label === "制作中"
                            ? "warning"
                            : "neutral"
                        }
                      >
                        {sc.label}
                      </GlassChip>
                      <ArrowRight className="h-4 w-4 text-zinc-700 group-hover:text-zinc-500 transition-all duration-200 group-hover:translate-x-0.5" />
                    </div>
                  </GlassSurface>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
