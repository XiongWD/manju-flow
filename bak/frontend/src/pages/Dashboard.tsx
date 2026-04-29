import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FolderKanban, Plus, ArrowRight, Zap, Layers } from 'lucide-react'
import { projectApi } from '@/lib/api'
import type { Project } from '@/types'

/** 状态配置 */
const statusConfig: Record<string, { label: string; color: string }> = {
  active: { label: '活跃', color: '#22C55E' },
  in_production: { label: '制作中', color: '#F59E0B' },
  completed: { label: '已完成', color: '#06B6D4' },
  archived: { label: '已归档', color: '#767D88' },
  DRAFT: { label: '草稿', color: '#767D88' },
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    projectApi.list().then(setProjects).catch(console.error)
  }, [])

  const recentProjects = projects.slice(0, 5)
  const activeCount = projects.filter(p => p.status === 'active' || p.status === 'in_production').length
  const completedCount = projects.filter(p => p.status === 'completed').length

  return (
    <div className="space-y-12">
      {/* ── Hero — 生产总览 ── */}
      <div className="animate-in">
        <div className="flex items-start justify-between">
          <div className="max-w-lg">
            <h1 className="display-hero text-white">
              制作线总览
            </h1>
            <p className="mt-4 body-ui text-[#7D8490] max-w-md">
              当前项目进度、渲染队列和质检状态集中在此。
            </p>
          </div>
          {/* 右侧状态摘要块 — 紧凑但清晰 */}
          <div className="surface-2 px-5 py-4 min-w-[180px] shrink-0 hidden sm:block">
            <div className="section-kicker mb-3">Production Status</div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="meta-ui">项目总数</span>
                <span className="font-display text-base font-semibold text-white">{projects.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="meta-ui">制作中</span>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#F59E0B]" />
                  <span className="font-display text-base font-semibold text-white">{activeCount}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="meta-ui">已完成</span>
                <span className="font-display text-base font-semibold text-white">{completedCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 快速操作 — 非对称布局 (2大 + 1宽) ── */}
      <div className="animate-in animate-in-delay-1">
        <div className="section-kicker mb-4">Quick Actions</div>
        <div className="grid grid-cols-2 gap-3">
          {/* 大卡 1: 最近项目 */}
          <Link
            to="/projects"
            className="group surface-2 hover-surface p-5 flex items-center gap-4"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.04] shrink-0">
              <FolderKanban className="h-[18px] w-[18px] text-[#7D8490]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white">全部项目</div>
              <div className="mt-0.5 meta-ui">{projects.length} 个</div>
            </div>
            <ArrowRight className="h-4 w-4 text-white/15 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-white/35 shrink-0" />
          </Link>

          {/* 大卡 2: 新建项目 */}
          <Link
            to="/projects"
            className="group surface-2 hover-surface p-5 flex items-center gap-4"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <Plus className="h-[18px] w-[18px] text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white">新建项目</div>
              <div className="mt-0.5 meta-ui">创建制作项目</div>
            </div>
            <ArrowRight className="h-4 w-4 text-white/15 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-white/35 shrink-0" />
          </Link>

          {/* 宽卡: 渲染队列 + QA 并排 */}
          <div className="col-span-2 grid grid-cols-2 gap-3">
            <Link
              to="/render"
              className="group surface-2 hover-surface p-4 flex items-center gap-3.5"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] shrink-0">
                <Zap className="h-4 w-4 text-[#7D8490]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-white">渲染队列</div>
              </div>
            </Link>
            <Link
              to="/qa"
              className="group surface-2 hover-surface p-4 flex items-center gap-3.5"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] shrink-0">
                <Layers className="h-4 w-4 text-[#7D8490]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-white">QA 中心</div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* ── 当前 Slate — 项目进度 ── */}
      <div className="animate-in animate-in-delay-2">
        <div className="flex items-center justify-between mb-4">
          <div className="section-kicker">Current Slate</div>
          <Link to="/projects" className="meta-ui hover:text-white/60 transition-colors duration-200 flex items-center gap-1">
            查看全部 <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {recentProjects.length === 0 ? (
          <div className="surface-2 flex flex-col items-center justify-center py-20">
            <FolderKanban className="h-8 w-8 text-white/[0.08] mb-3" />
            <span className="body-ui text-[#7D8490]">暂无项目</span>
            <span className="meta-ui mt-1">创建你的第一个制作项目</span>
          </div>
        ) : (
          <div className="space-y-2">
            {recentProjects.map((project) => {
              const sc = statusConfig[project.status] || { label: project.status, color: '#767D88' }
              return (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className="group surface-2 hover-surface flex items-center justify-between px-6 py-4"
                >
                  <div className="flex items-center gap-5 min-w-0">
                    {/* 状态色条 */}
                    <span
                      className="block h-8 w-[3px] rounded-full shrink-0"
                      style={{ backgroundColor: sc.color }}
                    />
                    <div className="min-w-0">
                      <div className="text-[15px] font-medium text-white truncate">{project.name}</div>
                      <div className="mt-0.5 flex items-center gap-2 meta-ui">
                        {project.genre && <span>{project.genre}</span>}
                        {project.market && (
                          <>
                            <span className="text-white/10">·</span>
                            <span>{project.market}</span>
                          </>
                        )}
                        {project.tier && (
                          <>
                            <span className="text-white/10">·</span>
                            <span className="font-mono text-[11px] uppercase">Tier {project.tier}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="meta-ui">{sc.label}</span>
                    <ArrowRight className="h-4 w-4 text-white/15 group-hover:text-white/40 transition-all duration-200 group-hover:translate-x-0.5" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
