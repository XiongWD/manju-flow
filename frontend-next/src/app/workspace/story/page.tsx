'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BookOpen } from 'lucide-react'
import { GlassSurface, GlassInput } from '@/components/ui/primitives'
import { PageHeader } from '@/components/workspace/PageHeader'
import { apiClient } from '@/lib/api-client'
import type { Project } from '@/types'

export default function StoryProjectPickerPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    apiClient.listProjects()
      .then(setProjects)
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return projects
    return projects.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.genre ?? '').toLowerCase().includes(q) ||
      (p.platform ?? '').toLowerCase().includes(q)
    )
  }, [projects, search])

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <PageHeader
        title="故事与角色"
        description="先选择项目，再进入对应项目的故事圣经与角色管理页面。"
      />

      <div className="mb-6 max-w-sm">
        <GlassInput
          placeholder="搜索项目名 / 题材 / 平台..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? Array.from({ length: 6 }).map((_, i) => (
          <GlassSurface key={i} variant="card" className="h-40 animate-pulse bg-white/[0.03]">
            <div />
          </GlassSurface>
        )) : filtered.map((project) => (
          <Link key={project.id} href={`/workspace/projects/${project.id}/story`}>
            <GlassSurface variant="card" interactive className="h-full space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-300">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-white">{project.name}</div>
                    <div className="text-xs text-zinc-500">{project.genre || '未设置题材'} · {project.platform || '未设置平台'}</div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-500" />
              </div>
              <p className="line-clamp-3 text-sm text-zinc-400">{project.description || '暂无项目描述'}</p>
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>状态：{project.status}</span>
                <span>进入故事页</span>
              </div>
            </GlassSurface>
          </Link>
        ))}
      </div>
    </div>
  )
}
