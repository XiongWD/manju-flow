'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, Plus, FolderKanban, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { GlassSurface, GlassButton, GlassInput, GlassModalShell, GlassToastContainer } from '@/components/ui/primitives'
import { ListSkeleton } from '@/components/Skeleton'
import { PageHeader } from '@/components/workspace/PageHeader'
import { apiClient } from '@/lib/api-client'
import type { Project, ProjectStatus } from '@/types'

const PLATFORM_OPTIONS = ['TikTok', '抖音', '快手']
const REGION_MAP: Record<string, string[]> = {
  TikTok: ['USA', 'UK', 'JP', 'SEA'],
  抖音: ['全国'],
  快手: ['全国'],
}
const GENRE_MAP: Record<string, string> = {
  Revenge: '复仇',
  Werewolf: '狼人',
  Mafia: '黑帮',
  CEO: '霸总',
  Romance: '言情',
  Fantasy: '奇幻',
  Thriller: '悬疑',
  Custom: '自定义'
}

const normalizeRegion = (value?: string) => {
  if (!value) return value
  if (value === 'US') return 'USA'
  return value
}
const GENRES = Object.keys(GENRE_MAP)
const TIERS = ['S', 'SSS', 'A', 'B']

const statusConfig: Record<string, { label: string; color: string }> = {
  active: { label: '运行中', color: '#22C55E' },
  in_production: { label: '制作中', color: '#F59E0B' },
  completed: { label: '已完成', color: '#06B6D4' },
  archived: { label: '已归档', color: '#767D88' },
  DRAFT: { label: '草稿', color: '#767D88' },
}

const gradients = [
  'from-violet-900/30 via-zinc-900/40 to-zinc-900',
  'from-blue-900/30 via-zinc-900/40 to-zinc-900',
  'from-emerald-900/30 via-zinc-900/40 to-zinc-900',
  'from-amber-900/25 via-zinc-900/40 to-zinc-900',
  'from-rose-900/25 via-zinc-900/40 to-zinc-900',
  'from-cyan-900/30 via-zinc-900/40 to-zinc-900',
]

export default function ProjectsPage() {
  const router = useRouter()
  const [pendingEditId, setPendingEditId] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState<Project | null>(null)
  const [showMenu, setShowMenu] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const [form, setForm] = useState({
    name: '',
    platform: 'TikTok',
    market: 'USA',
    genre: '',
    tier: '',
    budget_limit: '',
    description: '',
  })

  useEffect(() => {
    fetchProjects()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const editId = new URLSearchParams(window.location.search).get('edit')
    setPendingEditId(editId)
  }, [])

  useEffect(() => {
    if (!pendingEditId || projects.length === 0) return
    const target = projects.find((p) => p.id === pendingEditId)
    if (target) {
      openEdit(target)
      setPendingEditId(null)
      router.replace('/workspace/projects')
    }
  }, [pendingEditId, projects, router])

  const fetchProjects = async () => {
    try {
      setLoading(true)
      const data = await apiClient.listProjects()
      setProjects(data.items.map((p) => ({ ...p, market: normalizeRegion(p.market) })))
    } catch (error) {
      console.error('Failed to fetch projects:', error)
      setMessage({ type: 'error', text: '加载项目失败' })
    } finally {
      setLoading(false)
    }
  }

  const filtered = projects.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false
    if (!search) return true
    const q = search.toLowerCase()
    return p.name.toLowerCase().includes(q) || (p.genre?.toLowerCase() ?? '').includes(q)
  })

  const resetForm = () => {
    setForm({ name: '', platform: 'TikTok', market: 'USA', genre: '', tier: '', budget_limit: '', description: '' })
  }

  const openEdit = (project: Project) => {
    setEditing(project)
    setShowMenu(null)
    setForm({
      name: project.name,
      platform: project.platform ?? 'TikTok',
      market: normalizeRegion(project.market) ?? (project.platform === '抖音' || project.platform === '快手' ? '全国' : 'USA'),
      genre: project.genre ?? '',
      tier: project.tier ?? '',
      budget_limit: project.budget_limit?.toString() ?? '',
      description: project.description ?? '',
    })
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) return

    const data = {
      name: form.name.trim(),
      platform: form.platform || undefined,
      market: normalizeRegion(form.market) || undefined,
      genre: form.genre || undefined,
      tier: form.tier || undefined,
      budget_limit: form.budget_limit ? parseFloat(form.budget_limit) : undefined,
      description: form.description || undefined,
    }

    try {
      if (editing) {
        await apiClient.updateProject(editing.id, data)
        setMessage({ type: 'success', text: '项目已更新' })
        setEditing(null)
      } else {
        await apiClient.createProject(data)
        setMessage({ type: 'success', text: '项目已创建' })
        setShowCreate(false)
      }
      resetForm()
      fetchProjects()
    } catch (error) {
      console.error('Failed to save project:', error)
      setMessage({ type: 'error', text: '操作失败，请重试' })
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await apiClient.deleteProject(deleting.id)
      setMessage({ type: 'success', text: '项目已删除' })
      setDeleting(null)
      setShowMenu(null)
      fetchProjects()
    } catch (error) {
      console.error('Failed to delete project:', error)
      setMessage({ type: 'error', text: '删除失败，请重试' })
    }
  }

  const handleDeleteClick = (project: Project) => {
    setDeleting(project)
    setShowMenu(null)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <GlassToastContainer toasts={message ? [{ id: 'projects-toast', message: message.text, type: message.type === 'success' ? 'success' : 'error' }] : []} />

      <PageHeader
        title="项目"
        description="集中管理项目、编辑基础信息并查看制作状态。"
        actions={
          <GlassButton
            variant="primary"
            size="md"
            iconLeft={<Plus className="h-4 w-4" />}
            onClick={() => { resetForm(); setShowCreate(true) }}
          >
            新建项目
          </GlassButton>
        }
      />

      {/* Filter bar */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <GlassInput
            placeholder="搜索项目名 / 题材..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1 bg-zinc-900 rounded-lg p-1 border border-zinc-800">
          {[
            { value: 'all', label: '全部' },
            { value: 'active', label: '运行中' },
            { value: 'in_production', label: '制作中' },
            { value: 'completed', label: '已完成' },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-all duration-200 ${
                statusFilter === f.value
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="text-sm text-zinc-500 ml-auto">
          {filtered.length} 个项目
        </span>
      </div>

      {/* Content */}
      {loading ? (
        <ListSkeleton count={6} />
      ) : filtered.length === 0 ? (
        <GlassSurface variant="panel" className="py-16 text-center">
          <div className="mx-auto max-w-md space-y-2">
            <h3 className="text-lg font-semibold text-white">
              {search || statusFilter !== 'all' ? '没有匹配的项目' : '还没有项目'}
            </h3>
            <p className="text-sm text-zinc-500">
              {search || statusFilter !== 'all' ? '尝试调整搜索词或筛选条件。' : '创建你的第一个制作项目，开始进入工作流。'}
            </p>
          </div>
        </GlassSurface>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {filtered.map((project, idx) => {
            const sc = statusConfig[project.status] || { label: project.status === 'in_production' ? '制作中' : project.status === 'active' ? '运行中' : project.status === 'completed' ? '已完成' : project.status === 'archived' ? '已归档' : project.status, color: '#767D88' }
            const grad = gradients[idx % gradients.length]
            return (
              <div
                key={project.id}
                className="group relative overflow-hidden rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors bg-zinc-900/50"
              >
                {/* Cover */}
                <Link href={`/workspace/projects/${project.id}`} className="block">
                  <div className={`relative aspect-video bg-gradient-to-br ${grad}`}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <FolderKanban className="h-10 w-10 text-zinc-700" />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent" />
                    {project.tier && (
                      <div className="absolute top-3 left-3">
                        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-400 bg-zinc-950/50 px-2 py-0.5 rounded border border-zinc-800">
                          {project.tier}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>

                {/* Info */}
                <div className="px-4 py-3.5 bg-zinc-900/30">
                  <Link href={`/workspace/projects/${project.id}`} className="block">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium text-white truncate">{project.name}</div>
                      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: sc.color }} />
                        <span className="text-xs text-zinc-500">{sc.label}</span>
                      </div>
                    </div>
                  </Link>
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-zinc-500">
                    {project.genre && <span>{GENRE_MAP[project.genre] || project.genre}</span>}
                    {project.platform && (
                      <>
                        <span className="text-zinc-700">·</span>
                        <span>{project.platform}</span>
                      </>
                    )}
                    {project.market && (
                      <>
                        <span className="text-zinc-700">·</span>
                        <span>{project.market}</span>
                      </>
                    )}
                    {project.budget_limit && (
                      <>
                        <span className="text-zinc-700">·</span>
                        <span>${project.budget_limit.toLocaleString()}</span>
                      </>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-2 opacity-0 transition-all duration-200 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto">
                    <button className="rounded-md border border-zinc-700 bg-zinc-800/70 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-700/90" onClick={() => openEdit(project)}>✏️ 编辑</button>
                    <button className="rounded-md border border-red-950/50 bg-red-950/20 px-2.5 py-1 text-xs text-red-300 hover:bg-red-950/35" onClick={() => handleDeleteClick(project)}>🗑️ 删除</button>
                  </div>
                </div>

                {/* Menu */}
                <div className="absolute right-3 top-3">
                  <button
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-950/50 text-zinc-500 opacity-0 transition-all duration-200 group-hover:opacity-100 hover:bg-zinc-950 hover:text-zinc-300"
                    onClick={(e) => {
                      e.preventDefault()
                      setShowMenu(showMenu === project.id ? null : project.id)
                    }}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {showMenu === project.id && (
                    <div className="absolute right-0 top-8 z-10 min-w-[120px] bg-zinc-900 border border-zinc-800 rounded-lg shadow-lg py-1">
                      <button
                        className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors flex items-center gap-2"
                        onClick={() => openEdit(project)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        编辑
                      </button>
                      <button
                        className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-zinc-800 hover:text-red-300 transition-colors flex items-center gap-2"
                        onClick={() => handleDeleteClick(project)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        删除
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <GlassModalShell
        open={showCreate || !!editing}
        onClose={() => {
          setShowCreate(false)
          setEditing(null)
          resetForm()
        }}
        title={editing ? '编辑项目' : '新建项目'}
        size="md"
        closeOnBackdrop={true}
        footer={
          <div className="flex items-center justify-end gap-3">
            <GlassButton
              variant="ghost"
              onClick={() => {
                setShowCreate(false)
                setEditing(null)
                resetForm()
              }}
            >
              取消
            </GlassButton>
            <GlassButton
              variant="primary"
              onClick={handleSubmit}
              disabled={!form.name.trim()}
            >
              {editing ? '保存' : '创建'}
            </GlassButton>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">
              项目名称 <span className="text-red-400">*</span>
            </label>
            <GlassInput
              placeholder="输入项目名称"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">平台</label>
              <select
                className="w-full h-10 px-3 bg-zinc-800/50 border border-zinc-700 rounded-lg text-sm text-zinc-300 focus:border-zinc-500 focus:outline-none transition-colors"
                value={form.platform}
                onChange={(e) => {
                  const platform = e.target.value
                  setForm({ ...form, platform, market: REGION_MAP[platform]?.[0] || 'USA' })
                }}
              >
                {PLATFORM_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">地区</label>
              <select
                className="w-full h-10 px-3 bg-zinc-800/50 border border-zinc-700 rounded-lg text-sm text-zinc-300 focus:border-zinc-500 focus:outline-none transition-colors"
                value={form.market}
                onChange={(e) => setForm({ ...form, market: e.target.value })}
              >
                {(REGION_MAP[form.platform] || ['USA']).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">题材</label>
              <select
                className="w-full h-10 px-3 bg-zinc-800/50 border border-zinc-700 rounded-lg text-sm text-zinc-300 focus:border-zinc-500 focus:outline-none transition-colors"
                value={form.genre}
                onChange={(e) => setForm({ ...form, genre: e.target.value })}
              >
                <option value="">选择</option>
                {GENRES.map((g) => (
                  <option key={g} value={g}>{GENRE_MAP[g]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">制作等级</label>
              <select
                className="w-full h-10 px-3 bg-zinc-800/50 border border-zinc-700 rounded-lg text-sm text-zinc-300 focus:border-zinc-500 focus:outline-none transition-colors"
                value={form.tier}
                onChange={(e) => setForm({ ...form, tier: e.target.value })}
              >
                <option value="">选择</option>
                {TIERS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">预算（美元）</label>
            <GlassInput
              type="number"
              placeholder="可选"
              value={form.budget_limit}
              onChange={(e) => setForm({ ...form, budget_limit: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">项目描述</label>
            <textarea
              className="w-full min-h-[80px] px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-sm text-zinc-300 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none resize-none transition-colors"
              placeholder="可选"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </div>
      </GlassModalShell>

      {/* Delete Confirmation Modal */}
      <GlassModalShell
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="删除项目"
        description={`确定要删除「${deleting?.name}」吗？此操作不可恢复。`}
        size="sm"
        closeOnBackdrop={true}
        footer={
          <div className="flex items-center justify-end gap-3">
            <GlassButton variant="ghost" onClick={() => setDeleting(null)}>
              取消
            </GlassButton>
            <GlassButton variant="danger" onClick={handleDelete}>
              确认删除
            </GlassButton>
          </div>
        }
      >
        <div className="text-sm text-zinc-400">
          此操作将永久删除该项目及其所有数据，无法恢复。
        </div>
      </GlassModalShell>
    </div>
  )
}
