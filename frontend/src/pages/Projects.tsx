import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useProjectStore } from '@/stores/projectStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Plus, Search, MoreHorizontal, Pencil, Trash2, FolderKanban } from 'lucide-react'
import { toast } from 'sonner'
import type { Project } from '@/types'

const MARKETS = ['US', 'UK', 'SEA', 'CN', 'JP', 'KR']
const GENRE_MAP: Record<string, string> = { Revenge: '复仇', Werewolf: '狼人', Mafia: '黑帮', CEO: '霸总', Romance: '言情', Fantasy: '奇幻', Thriller: '悬疑', Custom: '自定义' }
const GENRES = Object.keys(GENRE_MAP)
const TIERS = ['S', 'SSS', 'A', 'B']

const statusConfig: Record<string, { label: string; color: string }> = {
  active: { label: '运行中', color: '#22C55E' },
  in_production: { label: '制作中', color: '#F59E0B' },
  completed: { label: '已完成', color: '#06B6D4' },
  archived: { label: '已归档', color: '#767D88' },
  DRAFT: { label: '草稿', color: '#767D88' },
}

/** Gradient placeholder backgrounds for project cards */
const gradients = [
  'from-violet-900/20 via-[#141416] to-[#141416]',
  'from-blue-900/20 via-[#141416] to-[#141416]',
  'from-emerald-900/20 via-[#141416] to-[#141416]',
  'from-amber-900/15 via-[#141416] to-[#141416]',
  'from-rose-900/15 via-[#141416] to-[#141416]',
  'from-cyan-900/20 via-[#141416] to-[#141416]',
]

export default function Projects() {
  const { projects, loading, fetchProjects, createProject, updateProject, deleteProject } = useProjectStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState<Project | null>(null)

  const [form, setForm] = useState({
    name: '',
    market: '',
    genre: '',
    tier: '',
    budget_limit: '',
    description: '',
  })

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const filtered = projects.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false
    if (!search) return true
    const q = search.toLowerCase()
    return p.name.toLowerCase().includes(q) || (p.genre?.toLowerCase() ?? '').includes(q)
  })

  const resetForm = () => {
    setForm({ name: '', market: '', genre: '', tier: '', budget_limit: '', description: '' })
  }

  const openEdit = (project: Project) => {
    setEditing(project)
    setForm({
      name: project.name,
      market: project.market ?? '',
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
      market: form.market || undefined,
      genre: form.genre || undefined,
      tier: form.tier || undefined,
      budget_limit: form.budget_limit ? parseFloat(form.budget_limit) : undefined,
      description: form.description || undefined,
    }

    try {
      if (editing) {
        await updateProject(editing.id, data)
        toast.success('项目已更新')
        setEditing(null)
      } else {
        await createProject(data)
        toast.success('项目已创建')
        setShowCreate(false)
      }
      resetForm()
    } catch {
      toast.error('操作失败，请重试')
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await deleteProject(deleting.id)
      toast.success('项目已删除')
      setDeleting(null)
    } catch {
      toast.error('删除失败，请重试')
    }
  }

  return (
    <div className="space-y-12">
      {/* ── 页面标题区 ── */}
      <div className="animate-in">
        <div className="section-kicker mb-3">Project Library</div>
        <div className="flex items-end justify-between">
          <h1 className="display-page text-white">
            项目
          </h1>
          <Button
            onClick={() => { resetForm(); setShowCreate(true) }}
            className="bg-primary text-white rounded-lg px-6 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors duration-200"
          >
            <Plus className="mr-2 h-4 w-4" />
            新建项目
          </Button>
        </div>
      </div>

      {/* ── 系统化筛选栏 ── */}
      <div className="flex items-center gap-4 animate-in animate-in-delay-1">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#767D88]" />
          <Input
            placeholder="搜索项目名 / 题材..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white/[0.03] border-white/[0.06] text-white text-sm placeholder:text-[#767D88] focus:border-primary/50 rounded-lg h-9"
          />
        </div>
        <div className="flex items-center gap-1 bg-white/[0.02] rounded-lg p-1">
          {[
            { value: 'all', label: '全部' },
            { value: 'active', label: '运行中' },
            { value: 'in_production', label: '制作中' },
            { value: 'completed', label: '已完成' },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 ease-out ${
                statusFilter === f.value
                  ? 'bg-white/[0.08] text-white'
                  : 'text-[#767D88] hover:text-white/60'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="meta-ui ml-auto">
          {filtered.length} 个项目
        </span>
      </div>

      {/* ── 内容区 ── */}
      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-video w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        /* 品牌感空状态 */
        <div className="flex flex-col items-center justify-center py-28">
          <span className="font-display text-3xl font-semibold text-white/[0.06] mb-3">
            {search || statusFilter !== 'all' ? '—' : '开始创作'}
          </span>
          <span className="body-ui text-[#7D8490]">
            {search || statusFilter !== 'all' ? '无匹配结果，尝试调整搜索条件' : '创建你的第一个制作项目'}
          </span>
        </div>
      ) : (
        /* ── Dossier Card Grid ── */
        <div className="grid grid-cols-3 gap-4 animate-in animate-in-delay-2">
          {filtered.map((project, idx) => {
            const sc = statusConfig[project.status] || { label: project.status, color: '#767D88' }
            const grad = gradients[idx % gradients.length]
            return (
              <div
                key={project.id}
                className="group relative overflow-hidden rounded-lg border border-white/[0.06] hover-surface"
              >
                {/* 封面区 — 影视视觉层 */}
                <Link to={`/projects/${project.id}`} className="block">
                  <div className={`relative aspect-video bg-gradient-to-br ${grad}`}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <FolderKanban className="h-10 w-10 text-white/[0.06]" />
                    </div>
                    {/* 底部渐变 overlay */}
                    <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    {/* Tier 角标 — 封面右上 */}
                    {project.tier && (
                      <div className="absolute top-3 right-3">
                        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-white/40 bg-black/40 px-2 py-0.5 rounded">
                          {project.tier}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>

                {/* 信息区 — 生产信息层 (dossier) */}
                <div className="bg-[#141416] px-4 py-3.5">
                  <Link to={`/projects/${project.id}`} className="block">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-[14px] font-medium text-white truncate">{project.name}</div>
                      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: sc.color }} />
                        <span className="meta-ui">{sc.label}</span>
                      </div>
                    </div>
                  </Link>
                  <div className="mt-1.5 flex items-center gap-2 meta-ui">
                    {project.genre && <span>{project.genre}</span>}
                    {project.market && (
                      <>
                        <span className="text-white/10">·</span>
                        <span>{project.market}</span>
                      </>
                    )}
                    {project.budget_limit && (
                      <>
                        <span className="text-white/10">·</span>
                        <span>${project.budget_limit.toLocaleString()}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* 右上角操作 (overlay on cover) */}
                <div className="absolute right-3 top-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-black/50 text-white/60 opacity-0 transition-all duration-200 group-hover:opacity-100 hover:bg-black/70 hover:text-white"
                        onClick={(e) => e.preventDefault()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.preventDefault(); openEdit(project) }}>
                        <Pencil className="mr-2 h-4 w-4" />
                        编辑
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-400 focus:text-red-400"
                        onClick={(e) => { e.preventDefault(); setDeleting(project) }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 创建/编辑 Modal */}
      <ProjectFormModal
        open={showCreate || !!editing}
        title={editing ? '编辑项目' : '新建项目'}
        form={form}
        setForm={setForm}
        onClose={() => {
          setShowCreate(false)
          setEditing(null)
          resetForm()
        }}
        onSubmit={handleSubmit}
      />

      {/* 删除确认 Modal */}
      <Dialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <DialogContent className="sm:max-w-[420px] bg-[#141416] border-white/[0.06] rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-white font-display">删除项目</DialogTitle>
            <DialogDescription className="text-[#767D88]">
              确定要删除「{deleting?.name}」吗？此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setDeleting(null)} className="border-white/[0.1] text-white/60 rounded-lg px-5 py-2 text-sm hover:bg-white/[0.04] hover:text-white/80">
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete} className="rounded-lg px-5 py-2 text-sm">
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** 项目表单 Modal — 统一 surface-2 风格 */
function ProjectFormModal({
  open,
  title,
  form,
  setForm,
  onClose,
  onSubmit,
}: {
  open: boolean
  title: string
  form: { name: string; market: string; genre: string; tier: string; budget_limit: string; description: string }
  setForm: (f: typeof form) => void
  onClose: () => void
  onSubmit: () => void
}) {
  const update = (key: keyof typeof form, value: string) => setForm({ ...form, [key]: value })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] bg-[#141416] border-white/[0.06] rounded-lg">
        <DialogHeader>
          <DialogTitle className="text-white font-display">{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-[#767D88] text-sm">
              项目名称 <span className="text-red-400">*</span>
            </Label>
            <Input
              id="name"
              placeholder="输入项目名称"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className="bg-white/[0.03] border-white/[0.06] text-white text-sm placeholder:text-[#767D88] focus:border-primary/50 rounded-lg h-9"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label className="text-[#767D88] text-sm">市场</Label>
              <select
                className="flex h-9 w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-sm text-white focus:border-primary/50 focus:outline-none"
                value={form.market}
                onChange={(e) => update('market', e.target.value)}
              >
                <option value="">选择</option>
                {MARKETS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-[#767D88] text-sm">题材</Label>
              <select
                className="flex h-9 w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-sm text-white focus:border-primary/50 focus:outline-none"
                value={form.genre}
                onChange={(e) => update('genre', e.target.value)}
              >
                <option value="">选择</option>
                {GENRES.map((g) => (
                  <option key={g} value={g}>{GENRE_MAP[g]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-[#767D88] text-sm">制作等级</Label>
              <select
                className="flex h-9 w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-sm text-white focus:border-primary/50 focus:outline-none"
                value={form.tier}
                onChange={(e) => update('tier', e.target.value)}
              >
                <option value="">选择</option>
                {TIERS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[#767D88] text-sm">预算（美元）</Label>
            <Input
              type="number"
              placeholder="可选"
              value={form.budget_limit}
              onChange={(e) => update('budget_limit', e.target.value)}
              className="bg-white/[0.03] border-white/[0.06] text-white text-sm placeholder:text-[#767D88] focus:border-primary/50 rounded-lg h-9"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[#767D88] text-sm">项目描述</Label>
            <textarea
              className="flex min-h-[80px] w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-[#767D88] focus:border-primary/50 focus:outline-none resize-none"
              placeholder="可选"
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={onClose} className="border-white/[0.1] text-white/60 rounded-lg px-5 py-2 text-sm hover:bg-white/[0.04] hover:text-white/80">
            取消
          </Button>
          <Button onClick={onSubmit} disabled={!form.name.trim()} className="bg-primary text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-primary/90 transition-colors duration-200">
            {title.startsWith('新建') ? '创建' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
