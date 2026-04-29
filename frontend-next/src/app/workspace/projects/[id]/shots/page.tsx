"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { apiClient, Episode, Scene } from "@/lib/api-client"
import GlassSurface from "@/components/ui/primitives/GlassSurface"
import GlassButton from "@/components/ui/primitives/GlassButton"
import GlassInput from "@/components/ui/primitives/GlassInput"
import GlassModalShell from "@/components/ui/primitives/GlassModalShell"
import GlassToastContainer from "@/components/ui/primitives/GlassToast"
import GlassLoadingBlock from "@/components/ui/primitives/GlassLoadingBlock"
import GlassEmptyState from "@/components/ui/primitives/GlassEmptyState"
import { PageHeader } from "@/components/workspace/PageHeader"

/* ── Toast (minimal inline) ──────────────────────────── */

interface Toast {
  id: number
  message: string
  type: "success" | "error"
}

let toastId = 0

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback((message: string, type: "success" | "error" = "success") => {
    const id = ++toastId
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }, [])

  return { toasts, show }
}

/* ── helpers ─────────────────────────────────────────── */

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "草稿", color: "bg-zinc-700/60 text-zinc-300" },
  IN_PRODUCTION: { label: "制作中", color: "bg-blue-900/40 text-blue-300" },
  PRODUCING: { label: "生成中", color: "bg-blue-900/40 text-blue-300" },
  COMPLETED: { label: "已完成", color: "bg-green-900/40 text-green-300" },
  FAILED: { label: "失败", color: "bg-red-900/40 text-red-300" },
  PENDING: { label: "等待中", color: "bg-yellow-900/40 text-yellow-300" },
  QUEUED: { label: "排队中", color: "bg-yellow-900/40 text-yellow-300" },
  RUNNING: { label: "运行中", color: "bg-blue-900/40 text-blue-300" },
  CANCELLED: { label: "已取消", color: "bg-zinc-700/60 text-zinc-400" },
  APPROVED: { label: "已通过", color: "bg-emerald-900/40 text-emerald-300" },
  REJECTED: { label: "已拒绝", color: "bg-red-900/40 text-red-300" },
}

function statusBadge(status: string) {
  const s = STATUS_MAP[status] ?? { label: status, color: "bg-zinc-700/60 text-zinc-400" }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
      {s.label}
    </span>
  )
}

function formatScore(snapshot?: Record<string, number>) {
  if (!snapshot || Object.keys(snapshot).length === 0) return null
  const entries = Object.entries(snapshot).slice(0, 3)
  return (
    <div className="mt-2 space-y-0.5">
      {entries.map(([k, v]) => (
        <div key={k} className="flex justify-between text-xs">
          <span className="text-zinc-500">{k}</span>
          <span className="text-zinc-300">{typeof v === "number" ? v.toFixed(1) : v}</span>
        </div>
      ))}
    </div>
  )
}

function formatFileSize(bytes?: number) {
  if (bytes == null) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/* ── Sortable Scene Card ────────────────────────────── */

function SortableSceneCard({
  scene,
  isSelected,
  onSelect,
  onOpenDetail,
  isDragging,
}: {
  scene: Scene
  isSelected: boolean
  onSelect: (id: string, e: React.SyntheticEvent) => void
  onOpenDetail: () => void
  isDragging: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: scene.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <GlassSurface
        variant="card"
        className={`relative p-4 cursor-pointer transition-colors group ${
          isSelected
            ? "border-blue-500/60 ring-1 ring-blue-500/30"
            : "hover:border-blue-500/30"
        }`}
      >
        {/* selection checkbox */}
        <div
          className="absolute top-2 left-2 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => onSelect(scene.id, e)}
              className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500/50 focus:ring-offset-0 cursor-pointer"
            />
          </label>
        </div>

        {/* drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="absolute top-2 right-2 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10"
          title="拖拽排序"
          onClick={(e) => e.stopPropagation()}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
            <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
            <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
          </svg>
        </div>

        {/* lock indicator */}
        {scene.locked_version_id && (
          <div className="absolute top-2 left-9 text-yellow-500" title="已锁定版本">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 8h-1V6A5 5 0 006 6v2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V10a2 2 0 00-2-2zM8 6a3 3 0 016 0v2H8V6z"/>
            </svg>
          </div>
        )}

        {/* click area (excludes checkbox & drag handle) */}
        <div onClick={(e) => {
          // only open detail if not selecting
          if ((e.target as HTMLElement).closest('input[type="checkbox"]')) return
          onOpenDetail()
        }}>
          {/* scene number */}
          <div className="text-xs text-zinc-500 mb-1 font-mono">
            #{String(scene.scene_no).padStart(3, "0")}
          </div>

          {/* title */}
          <h3 className="text-sm font-semibold text-zinc-100 mb-2 truncate">
            {scene.title || `镜头 #${scene.scene_no}`}
          </h3>

          {/* duration */}
          {scene.duration != null && (
            <div className="text-xs text-zinc-400 mb-2">
              ⏱ {scene.duration}s
            </div>
          )}

          {/* status badge */}
          <div className="mb-2">{statusBadge(scene.status)}</div>

          {/* version info */}
          {scene.latest_version && (
            <div className="mt-3 pt-3 border-t border-zinc-800/50">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">最新版本</span>
                <span className="text-zinc-300 font-mono">v{scene.latest_version.version_no}</span>
              </div>
              {formatScore(scene.latest_version.score_snapshot)}
            </div>
          )}
        </div>
      </GlassSurface>
    </div>
  )
}

/* ── page ────────────────────────────────────────────── */

export default function ShotEditorPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const { toasts, show: showToast } = useToast()

  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [selectedEpId, setSelectedEpId] = useState<string | null>(null)
  const [scenes, setScenes] = useState<Scene[]>([])
  const [loading, setLoading] = useState(true)

  // batch selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchMode, setBatchMode] = useState(false)

  // batch delete confirm
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false)
  const [batchDeleting, setBatchDeleting] = useState(false)

  // batch status change
  const [showBatchStatusModal, setShowBatchStatusModal] = useState(false)
  const [batchStatusValue, setBatchStatusValue] = useState("")
  const [batchStatusSaving, setBatchStatusSaving] = useState(false)

  // reorder saving
  const [reordering, setReordering] = useState(false)

  // detail modal
  const [detailScene, setDetailScene] = useState<Scene | null>(null)
  const [versionTree, setVersionTree] = useState<import("@/lib/api-client").SceneVersionTreeResponse | null>(null)
  const [loadingTree, setLoadingTree] = useState(false)

  // create modal
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ scene_no: "", title: "", duration: "" })
  const [creating, setCreating] = useState(false)

  // edit modal
  const [editForm, setEditForm] = useState<{ title: string; duration: string }>({ title: "", duration: "" })
  const [saving, setSaving] = useState(false)

  // delete confirm
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Scene | null>(null)
  const [deleting, setDeleting] = useState(false)

  // version diff modal
  const [diffData, setDiffData] = useState<import("@/lib/api-client").VersionDiffResponse | null>(null)
  const [loadingDiff, setLoadingDiff] = useState(false)
  const [diffLabelA, setDiffLabelA] = useState("")
  const [diffLabelB, setDiffLabelB] = useState("")

  // version switch confirm
  const [showSwitchConfirm, setShowSwitchConfirm] = useState<import("@/lib/api-client").SceneVersionTreeNode | null>(null)
  const [switching, setSwitching] = useState(false)

  // scene assets
  const [sceneAssets, setSceneAssets] = useState<{ id: string; type: string; uri?: string; mime_type?: string; file_size?: number; width?: number; height?: number }[]>([])
  const [loadingAssets, setLoadingAssets] = useState(false)

  // view mode: card | timeline
  const [viewMode, setViewMode] = useState<'card' | 'timeline'>('card')

  // batch duration adjust
  const [showBatchDurationModal, setShowBatchDurationModal] = useState(false)
  const [batchDurationMode, setBatchDurationMode] = useState<'set' | 'add' | 'multiply'>('set')
  const [batchDurationValue, setBatchDurationValue] = useState('')
  const [batchDurationSaving, setBatchDurationSaving] = useState(false)

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const loadEpisodes = useCallback(async () => {
    try {
      const eps = await apiClient.listEpisodes({ project_id: projectId })
      setEpisodes(eps)
      if (eps.length > 0 && !selectedEpId) setSelectedEpId(eps[0].id)
    } catch { /* empty */ }
  }, [projectId, selectedEpId])

  const loadScenes = useCallback(async (epId: string) => {
    setLoading(true)
    try {
      const list = await apiClient.listScenes({ episode_id: epId })
      setScenes(list.sort((a, b) => a.scene_no - b.scene_no))
      setSelectedIds(new Set())
    } catch { setScenes([]) }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadEpisodes().then(() => setLoading(false))
  }, [loadEpisodes])

  useEffect(() => {
    if (selectedEpId) loadScenes(selectedEpId)
  }, [selectedEpId, loadScenes])

  /* ── DnD handlers ─────────────────────────────────── */

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = scenes.findIndex((s) => s.id === active.id)
    const newIndex = scenes.findIndex((s) => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    // optimistic update
    const reordered = arrayMove(scenes, oldIndex, newIndex)
    setScenes(reordered)

    // persist to backend
    setReordering(true)
    try {
      await apiClient.reorderScenes(reordered.map((s) => s.id))
      showToast("排序已保存")
    } catch {
      // rollback
      setScenes(scenes)
      showToast("排序保存失败", "error")
    }
    setReordering(false)
  }

  /* ── Batch selection ──────────────────────────────── */

  const toggleSelect = useCallback((id: string, e: React.SyntheticEvent) => {
    e.stopPropagation()
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(scenes.map((s) => s.id)))
  }, [scenes])

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const toggleBatchMode = useCallback(() => {
    if (batchMode) {
      setBatchMode(false)
      setSelectedIds(new Set())
    } else {
      setBatchMode(true)
    }
  }, [batchMode])

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return
    setBatchDeleting(true)
    try {
      const result = await apiClient.batchDeleteScenes(Array.from(selectedIds))
      showToast(`已删除 ${result.count} 个分镜`)
      setShowBatchDeleteConfirm(false)
      setSelectedIds(new Set())
      setBatchMode(false)
      if (selectedEpId) await loadScenes(selectedEpId)
      if (detailScene && selectedIds.has(detailScene.id)) {
        setDetailScene(null)
        setVersionTree(null)
      }
    } catch {
      showToast("批量删除失败", "error")
    }
    setBatchDeleting(false)
  }

  const handleBatchStatus = async () => {
    if (selectedIds.size === 0 || !batchStatusValue) return
    setBatchStatusSaving(true)
    try {
      await apiClient.batchUpdateSceneStatus(Array.from(selectedIds), batchStatusValue)
      showToast(`已将 ${selectedIds.size} 个分镜状态修改为 ${STATUS_MAP[batchStatusValue]?.label ?? batchStatusValue}`)
      setShowBatchStatusModal(false)
      setBatchStatusValue("")
      setSelectedIds(new Set())
      setBatchMode(false)
      if (selectedEpId) await loadScenes(selectedEpId)
    } catch {
      showToast("批量修改状态失败", "error")
    }
    setBatchStatusSaving(false)
  }

  /* ── Scene detail ─────────────────────────────────── */

  const openDetail = async (scene: Scene) => {
    setDetailScene(scene)
    setEditForm({ title: scene.title ?? "", duration: String(scene.duration ?? "") })
    setLoadingTree(true)
    setLoadingAssets(true)
    try {
      const tree = await apiClient.getSceneVersionTree(scene.id)
      setVersionTree(tree)
    } catch { setVersionTree(null) }
    setLoadingTree(false)
    try {
      const assets = await apiClient.listAssets({ owner_type: "scene_version", owner_id: scene.latest_version?.id ?? scene.id, limit: 20 })
      setSceneAssets(assets)
    } catch { setSceneAssets([]) }
    setLoadingAssets(false)
  }

  const handleSaveEdit = async () => {
    if (!detailScene) return
    setSaving(true)
    try {
      await apiClient.updateScene(detailScene.id, {
        title: editForm.title || undefined,
        duration: editForm.duration ? Number(editForm.duration) : undefined,
      })
      await loadScenes(selectedEpId!)
      setDetailScene({ ...detailScene, title: editForm.title, duration: Number(editForm.duration) || undefined })
      showToast("保存成功")
    } catch {
      showToast("保存失败，请重试", "error")
    }
    setSaving(false)
  }

  const handleCreate = async () => {
    if (!selectedEpId) return
    setCreating(true)
    try {
      await apiClient.createScene({
        episode_id: selectedEpId,
        scene_no: Number(createForm.scene_no),
        title: createForm.title || undefined,
        duration: createForm.duration ? Number(createForm.duration) : undefined,
      })
      await loadScenes(selectedEpId)
      setShowCreate(false)
      setCreateForm({ scene_no: "", title: "", duration: "" })
      showToast("分镜创建成功")
    } catch {
      showToast("创建失败，请重试", "error")
    }
    setCreating(false)
  }

  const handleDelete = async () => {
    if (!showDeleteConfirm || !selectedEpId) return
    setDeleting(true)
    try {
      await apiClient.deleteScene(showDeleteConfirm.id)
      await loadScenes(selectedEpId)
      setShowDeleteConfirm(null)
      if (detailScene?.id === showDeleteConfirm.id) {
        setDetailScene(null)
        setVersionTree(null)
      }
      showToast("分镜已删除")
    } catch {
      showToast("删除失败，请重试", "error")
    }
    setDeleting(false)
  }

  const handleRework = async (version: import("@/lib/api-client").SceneVersionTreeNode) => {
    if (!detailScene) return
    try {
      await apiClient.reworkSceneVersion(detailScene.id, {
        scene_version_id: version.id,
        change_reason: "手动返修",
        project_id: projectId,
      })
      showToast("返修任务已提交")
      openDetail(detailScene)
    } catch {
      showToast("返修失败，请重试", "error")
    }
  }

  const handleRetry = async () => {
    if (!detailScene) return
    try {
      await apiClient.retryScene(detailScene.id, projectId, selectedEpId ?? undefined)
      showToast("重试任务已提交")
    } catch {
      showToast("重试失败，请重试", "error")
    }
  }

  const handleVersionDiff = async (vA: import("@/lib/api-client").SceneVersionTreeNode, vB: import("@/lib/api-client").SceneVersionTreeNode) => {
    if (!detailScene) return
    setLoadingDiff(true)
    setDiffLabelA(`v${vA.version_no}`)
    setDiffLabelB(`v${vB.version_no}`)
    try {
      const diff = await apiClient.getSceneVersionDiff(detailScene.id, vA.id, vB.id)
      setDiffData(diff)
    } catch {
      showToast("版本对比加载失败", "error")
      setDiffData(null)
    }
    setLoadingDiff(false)
  }

  const handleSwitchLocked = async () => {
    if (!detailScene || !showSwitchConfirm) return
    setSwitching(true)
    try {
      await apiClient.switchLockedVersion(detailScene.id, {
        scene_version_id: showSwitchConfirm.id,
      })
      showToast(`已切换锁定版本到 v${showSwitchConfirm.version_no}`)
      openDetail(detailScene)
      setShowSwitchConfirm(null)
    } catch {
      showToast("切换锁定版本失败", "error")
    }
    setSwitching(false)
  }

  const totalDuration = scenes.reduce((sum, s) => sum + (s.duration ?? 0), 0)

  const handleBatchDuration = async () => {
    if (selectedIds.size === 0 || !batchDurationValue) return
    setBatchDurationSaving(true)
    try {
      await apiClient.batchUpdateSceneDuration(Array.from(selectedIds), batchDurationMode, Number(batchDurationValue))
      const modeLabel = batchDurationMode === 'set' ? '设为' : batchDurationMode === 'add' ? '增减' : '缩放'
      showToast(`已将 ${selectedIds.size} 个分镜时长${modeLabel} ${batchDurationValue}${batchDurationMode === 'multiply' ? ' 倍' : ' 秒'}`)
      setShowBatchDurationModal(false)
      setBatchDurationValue('')
      setSelectedIds(new Set())
      setBatchMode(false)
      if (selectedEpId) await loadScenes(selectedEpId)
    } catch {
      showToast('批量调整时长失败', 'error')
    }
    setBatchDurationSaving(false)
  }

  const selectedEp = episodes.find((e) => e.id === selectedEpId)

  return (
    <div className="min-h-screen bg-zinc-950 p-4 md:p-6 lg:p-8">
      <GlassToastContainer toasts={toasts} />

      <div className="mb-6">
        <button
          onClick={() => router.push('/workspace/shots')}
          className="mb-3 inline-block text-sm text-zinc-400 transition-colors hover:text-zinc-200"
        >
          ← 返回项目列表
        </button>
        <div className="flex items-start justify-between gap-4">
          <PageHeader
            title="分镜编辑器"
            description="管理分镜列表、批量操作、时间线视图与版本细节。"
          />
          <div className="flex items-center gap-2 pt-1">
            {/* batch mode toggle */}
            {scenes.length > 0 && (
              <GlassButton
                variant={batchMode ? "primary" : "secondary"}
                size="sm"
                onClick={toggleBatchMode}
              >
                {batchMode ? "✕ 退出批量" : "☐ 批量操作"}
              </GlassButton>
            )}
            {scenes.length > 0 && (
              <div className="flex items-center gap-1 bg-zinc-800/60 rounded-lg p-0.5 border border-zinc-700/50">
                <button
                  onClick={() => setViewMode('card')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    viewMode === 'card'
                      ? 'bg-blue-600/30 text-blue-300'
                      : 'text-zinc-400 hover:text-zinc-300'
                  }`}
                  title="卡片视图"
                >
                  ▦ 卡片
                </button>
                <button
                  onClick={() => setViewMode('timeline')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    viewMode === 'timeline'
                      ? 'bg-blue-600/30 text-blue-300'
                      : 'text-zinc-400 hover:text-zinc-300'
                  }`}
                  title="时间线视图"
                >
                  ▬ 时间线
                </button>
              </div>
            )}
            <GlassButton
              variant="primary"
              size="sm"
              disabled={!selectedEpId}
              onClick={() => setShowCreate(true)}
            >
              + 添加分镜
            </GlassButton>
          </div>
        </div>
      </div>

      {/* episode selector */}
      {episodes.length > 0 && (
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 scrollbar-thin">
          {episodes.map((ep) => (
            <button
              key={ep.id}
              onClick={() => setSelectedEpId(ep.id)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                ep.id === selectedEpId
                  ? "bg-blue-600/30 text-blue-300 border border-blue-500/40"
                  : "bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-700/60 hover:text-zinc-300"
              }`}
            >
              第 {ep.episode_no} 集{ep.title ? ` · ${ep.title}` : ""}
            </button>
          ))}
        </div>
      )}

      {/* batch action bar */}
      {batchMode && scenes.length > 0 && (
        <div className="mb-4 flex items-center gap-3 p-3 rounded-lg bg-zinc-900/80 border border-zinc-700/50">
          <span className="text-sm text-zinc-300">
            已选择 <span className="text-blue-400 font-medium">{selectedIds.size}</span> / {scenes.length} 个分镜
          </span>
          <div className="flex gap-2 ml-auto">
            <GlassButton variant="ghost" size="sm" onClick={selectedIds.size === scenes.length ? deselectAll : selectAll}>
              {selectedIds.size === scenes.length ? "取消全选" : "全选"}
            </GlassButton>
            <GlassButton
              variant="secondary"
              size="sm"
              disabled={selectedIds.size === 0}
              onClick={() => setShowBatchStatusModal(true)}
            >
              修改状态
            </GlassButton>
            <GlassButton
              variant="secondary"
              size="sm"
              disabled={selectedIds.size === 0}
              onClick={() => { setBatchDurationMode('set'); setBatchDurationValue(''); setShowBatchDurationModal(true) }}
            >
              ⏱ 调整时长
            </GlassButton>
            <GlassButton
              variant="danger"
              size="sm"
              disabled={selectedIds.size === 0}
              onClick={() => setShowBatchDeleteConfirm(true)}
            >
              批量删除
            </GlassButton>
          </div>
        </div>
      )}

      {/* reordering indicator */}
      {reordering && (
        <div className="mb-4 text-center text-sm text-blue-400 animate-pulse">
          正在保存排序...
        </div>
      )}

      {loading && <GlassLoadingBlock message="正在加载分镜数据…" />}

      {/* no episodes */}
      {!loading && episodes.length === 0 && (
        <GlassEmptyState
          title="该项目暂无剧集"
          description="请先创建剧集，再进入分镜编辑器继续管理场景与版本。"
          actions={
            <GlassButton
              variant="secondary"
              onClick={() => router.push(`/workspace/projects/${projectId}`)}
            >
              返回项目管理
            </GlassButton>
          }
        />
      )}

      {/* no scenes */}
      {!loading && episodes.length > 0 && scenes.length === 0 && (
        <GlassEmptyState
          title="当前集暂无分镜"
          description="先新建第一条分镜，再继续做批量排序、时间线与版本管理。"
          actions={
            <GlassButton variant="primary" onClick={() => setShowCreate(true)}>
              + 添加第一个分镜
            </GlassButton>
          }
        />
      )}

      {/* scene grid — DnD (card view) */}
      {!loading && scenes.length > 0 && viewMode === 'card' && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={scenes.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {scenes.map((scene) => (
                <SortableSceneCard
                  key={scene.id}
                  scene={scene}
                  isSelected={selectedIds.has(scene.id)}
                  onSelect={toggleSelect}
                  onOpenDetail={() => openDetail(scene)}
                  isDragging={false}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* timeline view */}
      {!loading && scenes.length > 0 && viewMode === 'timeline' && (
        <div className="space-y-4">
          {/* summary bar */}
          <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
            <span>{scenes.length} 个分镜</span>
            <span>总时长 <span className="text-zinc-300 font-mono">{totalDuration.toFixed(1)}s</span> ({Math.floor(totalDuration / 60)}:{String(Math.floor(totalDuration % 60)).padStart(2, '0')})</span>
          </div>

          {/* time ruler */}
          <div className="relative">
            <div className="flex items-end text-[10px] text-zinc-600 font-mono mb-1">
              <span>0s</span>
              <div className="flex-1" />
              <span>{totalDuration.toFixed(0)}s</span>
            </div>
            <div className="h-px bg-zinc-700/50" />
          </div>

          {/* timeline tracks */}
          <div className="relative space-y-0.5">
            {/* background grid */}
            {totalDuration > 0 && (
              <div className="absolute inset-0 flex pointer-events-none">
                {Array.from({ length: Math.min(Math.ceil(totalDuration / 10), 30) }).map((_, i) => (
                  <div
                    key={i}
                    className="border-l border-zinc-800/40 h-full"
                    style={{ width: `${100 / Math.ceil(totalDuration / 10)}%` }}
                  />
                ))}
              </div>
            )}

            {scenes.map((scene, idx) => {
              const dur = scene.duration ?? 2
              const widthPct = totalDuration > 0 ? (dur / totalDuration) * 100 : 0
              const leftPct = (() => {
                let acc = 0
                for (let i = 0; i < idx; i++) acc += scenes[i].duration ?? 2
                return totalDuration > 0 ? (acc / totalDuration) * 100 : 0
              })()

              const statusColor: Record<string, string> = {
                DRAFT: 'bg-zinc-600/50 border-zinc-500/40',
                IN_PRODUCTION: 'bg-blue-800/40 border-blue-600/40',
                PRODUCING: 'bg-blue-800/40 border-blue-600/40',
                COMPLETED: 'bg-green-800/40 border-green-600/40',
                FAILED: 'bg-red-800/40 border-red-600/40',
                PENDING: 'bg-yellow-800/40 border-yellow-600/40',
                QUEUED: 'bg-yellow-800/40 border-yellow-600/40',
                RUNNING: 'bg-blue-800/40 border-blue-600/40',
                CANCELLED: 'bg-zinc-700/40 border-zinc-600/40',
                APPROVED: 'bg-emerald-800/40 border-emerald-600/40',
                REJECTED: 'bg-red-800/40 border-red-600/40',
              }
              const colorClass = statusColor[scene.status] || 'bg-zinc-600/50 border-zinc-500/40'

              return (
                <div
                  key={scene.id}
                  className={`relative ${colorClass} border rounded-md px-2 py-1.5 cursor-pointer transition-all hover:brightness-125 group ${
                    selectedIds.has(scene.id) ? 'ring-1 ring-blue-500/50' : ''
                  }`}
                  style={{
                    position: 'relative',
                    marginLeft: `${leftPct}%`,
                    width: `${Math.max(widthPct, 1.5)}%`,
                  }}
                  onClick={(e) => {
                    if (batchMode) {
                      toggleSelect(scene.id, e)
                    } else {
                      openDetail(scene)
                    }
                  }}
                  title={`${scene.title || `镜头 #${scene.scene_no}`} · ${dur}s · ${STATUS_MAP[scene.status]?.label ?? scene.status}`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {batchMode && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(scene.id)}
                        onChange={(e) => { e.stopPropagation(); toggleSelect(scene.id, e) }}
                        className="w-3 h-3 rounded border-zinc-500 bg-zinc-700 text-blue-500 flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    <span className="text-[10px] text-zinc-400 font-mono flex-shrink-0">
                      #{String(scene.scene_no).padStart(3, '0')}
                    </span>
                    <span className="text-xs text-zinc-200 truncate">
                      {scene.title || `镜头 #${scene.scene_no}`}
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                    {dur}s
                  </div>
                  {/* duration bar inside */}
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10 rounded-b" />
                </div>
              )
            })}
          </div>

          {/* duration distribution mini chart */}
          <div className="mt-6 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/50">
            <h3 className="text-xs text-zinc-400 mb-2">时长分布</h3>
            <div className="flex items-end gap-px h-12">
              {scenes.map((scene) => {
                const dur = scene.duration ?? 2
                const maxDur = Math.max(...scenes.map(s => s.duration ?? 2))
                const heightPct = maxDur > 0 ? (dur / maxDur) * 100 : 0
                return (
                  <div
                    key={scene.id}
                    className="flex-1 min-w-[2px] rounded-t transition-all hover:brightness-150 cursor-pointer"
                    style={{ height: `${Math.max(heightPct, 4)}%` }}
                    title={`${scene.title || `镜头 #${scene.scene_no}`}: ${dur}s`}
                    onClick={() => openDetail(scene)}
                  />
                )
              })}
            </div>
            <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
              <span>#{String(scenes[0]?.scene_no ?? 0).padStart(3, '0')}</span>
              <span>#{String(scenes[scenes.length - 1]?.scene_no ?? 0).padStart(3, '0')}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Scene Detail Modal ────────────────────────── */}
      <GlassModalShell
        open={!!detailScene}
        onClose={() => { setDetailScene(null); setVersionTree(null); setSceneAssets([]) }}
        title={detailScene ? `${detailScene.title || `镜头 #${detailScene.scene_no}`}` : ""}
        description={detailScene ? `镜头 #${String(detailScene.scene_no).padStart(3, "0")} · ${statusBadge(detailScene.status)}` : undefined}
        size="lg"
        footer={
          detailScene ? (
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <GlassButton variant="ghost" size="sm" onClick={handleRetry}>
                  🔄 重试
                </GlassButton>
                <GlassButton variant="danger" size="sm" onClick={() => setShowDeleteConfirm(detailScene)}>
                  🗑 删除
                </GlassButton>
              </div>
              <div className="flex gap-2">
                <GlassButton variant="secondary" onClick={() => { setDetailScene(null); setVersionTree(null); setSceneAssets([]) }}>
                  关闭
                </GlassButton>
                <GlassButton variant="primary" onClick={handleSaveEdit} loading={saving}>
                  保存修改
                </GlassButton>
              </div>
            </div>
          ) : undefined
        }
      >
        {detailScene && (
          <div className="space-y-6">
            {/* basic info edit */}
            <div>
              <h3 className="text-sm font-medium text-zinc-300 mb-3">基础信息</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">标题</label>
                  <GlassInput
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    placeholder="镜头标题"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">时长 (秒)</label>
                  <GlassInput
                    type="number"
                    min={0}
                    value={editForm.duration}
                    onChange={(e) => setEditForm({ ...editForm, duration: e.target.value })}
                    placeholder="秒"
                  />
                </div>
              </div>
            </div>

            {/* assets preview */}
            <div>
              <h3 className="text-sm font-medium text-zinc-300 mb-3">关联资源</h3>
              {loadingAssets ? (
                <div className="text-zinc-500 text-sm py-4 text-center">加载资源中...</div>
              ) : sceneAssets.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {sceneAssets.map((asset) => {
                    const isImage = asset.mime_type?.startsWith("image/") ?? false
                    const isVideo = asset.mime_type?.startsWith("video/") ?? false
                    return (
                      <GlassSurface key={asset.id} variant="card" className="p-2 space-y-1">
                        <div className="aspect-video bg-zinc-800/60 rounded-lg overflow-hidden flex items-center justify-center">
                          {isImage && asset.uri ? (
                            <img src={asset.uri} alt={asset.type} className="w-full h-full object-cover" loading="lazy" />
                          ) : isVideo ? (
                            <span className="text-zinc-500 text-xs">🎬 视频</span>
                          ) : asset.uri ? (
                            <a href={asset.uri} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 underline truncate px-2 text-center">
                              🔗 打开资源
                            </a>
                          ) : (
                            <span className="text-zinc-600 text-xs">暂无预览</span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-400 truncate">
                          {asset.type}
                          {asset.file_size != null && ` · ${formatFileSize(asset.file_size)}`}
                        </div>
                        {asset.width != null && asset.height != null && (
                          <div className="text-xs text-zinc-500">{asset.width}×{asset.height}</div>
                        )}
                      </GlassSurface>
                    )
                  })}
                </div>
              ) : (
                <div className="text-zinc-500 text-sm py-4 text-center">暂无关联资源</div>
              )}
            </div>

            {/* version tree */}
            <div>
              <h3 className="text-sm font-medium text-zinc-300 mb-3">版本历史</h3>
              {loadingTree ? (
                <div className="text-zinc-500 text-sm py-4 text-center">加载版本树...</div>
              ) : versionTree && versionTree.versions.length > 0 ? (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {versionTree.versions
                    .sort((a, b) => b.version_no - a.version_no)
                    .map((v, idx, arr) => (
                      <GlassSurface key={v.id} variant="card" className="p-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono text-zinc-200">v{v.version_no}</span>
                            {statusBadge(v.status)}
                          </div>
                          <div className="flex items-center gap-2">
                            {versionTree.locked_version_id === v.id && (
                              <span className="text-xs text-yellow-500">🔒 已锁定</span>
                            )}
                            {idx < arr.length - 1 && (
                              <GlassButton variant="ghost" size="sm" className="text-xs px-2 py-0.5"
                                onClick={(e) => { e.stopPropagation(); handleVersionDiff(arr[idx + 1], v) }}>
                                ⚖ 对比
                              </GlassButton>
                            )}
                            {versionTree.locked_version_id !== v.id && (
                              <GlassButton variant="ghost" size="sm" className="text-xs px-2 py-0.5 text-yellow-400 hover:text-yellow-300"
                                onClick={(e) => { e.stopPropagation(); setShowSwitchConfirm(v) }}>
                                🔒 锁定
                              </GlassButton>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-zinc-500">耗时:</span>{" "}
                            <span className="text-zinc-300">{v.cost_actual != null ? `¥${v.cost_actual.toFixed(2)}` : "—"}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500">原因:</span>{" "}
                            <span className="text-zinc-300">{v.change_reason || "—"}</span>
                          </div>
                        </div>
                        {formatScore(v.score_snapshot)}
                        <div className="mt-2 flex gap-2">
                          <GlassButton variant="ghost" size="sm" onClick={() => handleRework(v)}>
                            返修
                          </GlassButton>
                        </div>
                      </GlassSurface>
                    ))}
                </div>
              ) : (
                <div className="text-zinc-500 text-sm py-4 text-center">暂无版本记录</div>
              )}
            </div>
          </div>
        )}
      </GlassModalShell>

      {/* ── Create Scene Modal ────────────────────────── */}
      <GlassModalShell
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="添加分镜"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <GlassButton variant="secondary" onClick={() => setShowCreate(false)}>取消</GlassButton>
            <GlassButton variant="primary" onClick={handleCreate} loading={creating}>创建</GlassButton>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">镜头序号 *</label>
            <GlassInput type="number" min={1} value={createForm.scene_no}
              onChange={(e) => setCreateForm({ ...createForm, scene_no: e.target.value })} placeholder="1" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">标题</label>
            <GlassInput value={createForm.title}
              onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} placeholder="镜头标题" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">时长 (秒)</label>
            <GlassInput type="number" min={0} value={createForm.duration}
              onChange={(e) => setCreateForm({ ...createForm, duration: e.target.value })} placeholder="秒" />
          </div>
        </div>
      </GlassModalShell>

      {/* ── Delete Confirm Modal ──────────────────────── */}
      <GlassModalShell
        open={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        title="确认删除"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <GlassButton variant="secondary" onClick={() => setShowDeleteConfirm(null)}>取消</GlassButton>
            <GlassButton variant="danger" onClick={handleDelete} loading={deleting}>确认删除</GlassButton>
          </div>
        }
      >
        <div className="text-sm text-zinc-400">
          确定要删除镜头 <span className="text-zinc-200 font-medium">#{String(showDeleteConfirm?.scene_no ?? 0).padStart(3, "0")} {showDeleteConfirm?.title || ""}</span> 吗？
          <br />
          <span className="text-red-400 text-xs mt-2 block">此操作不可撤销，关联的版本和资源记录将一并删除。</span>
        </div>
      </GlassModalShell>

      {/* ── Batch Delete Confirm Modal ────────────────── */}
      <GlassModalShell
        open={showBatchDeleteConfirm}
        onClose={() => setShowBatchDeleteConfirm(false)}
        title="确认批量删除"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <GlassButton variant="secondary" onClick={() => setShowBatchDeleteConfirm(false)}>取消</GlassButton>
            <GlassButton variant="danger" onClick={handleBatchDelete} loading={batchDeleting}>
              确认删除 ({selectedIds.size})
            </GlassButton>
          </div>
        }
      >
        <div className="text-sm text-zinc-400">
          确定要删除选中的 <span className="text-zinc-200 font-medium">{selectedIds.size}</span> 个分镜吗？
          <br />
          <span className="text-red-400 text-xs mt-2 block">此操作不可撤销，关联的版本和资源记录将一并删除。</span>
        </div>
      </GlassModalShell>

      {/* ── Batch Status Modal ────────────────────────── */}
      <GlassModalShell
        open={showBatchStatusModal}
        onClose={() => { setShowBatchStatusModal(false); setBatchStatusValue("") }}
        title="批量修改状态"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <GlassButton variant="secondary" onClick={() => { setShowBatchStatusModal(false); setBatchStatusValue("") }}>取消</GlassButton>
            <GlassButton variant="primary" onClick={handleBatchStatus} loading={batchStatusSaving} disabled={!batchStatusValue}>
              确认修改
            </GlassButton>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="text-sm text-zinc-400">
            将 <span className="text-zinc-200 font-medium">{selectedIds.size}</span> 个分镜的状态修改为：
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(STATUS_MAP).map(([key, { label }]) => (
              <button
                key={key}
                onClick={() => setBatchStatusValue(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  batchStatusValue === key
                    ? "border-blue-500/50 bg-blue-900/40 text-blue-300"
                    : "border-zinc-700/50 bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700/60 hover:text-zinc-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </GlassModalShell>

      {/* ── Batch Duration Adjust Modal ──────────────── */}
      <GlassModalShell
        open={showBatchDurationModal}
        onClose={() => { setShowBatchDurationModal(false); setBatchDurationValue('') }}
        title="批量调整时长"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <GlassButton variant="secondary" onClick={() => { setShowBatchDurationModal(false); setBatchDurationValue('') }}>取消</GlassButton>
            <GlassButton variant="primary" onClick={handleBatchDuration} loading={batchDurationSaving} disabled={!batchDurationValue}>
              确认调整
            </GlassButton>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="text-sm text-zinc-400">
            调整 <span className="text-zinc-200 font-medium">{selectedIds.size}</span> 个分镜的时长
          </div>
          <div className="flex gap-2">
            {([['set', '设为固定值'], ['add', '增加/减少'], ['multiply', '按倍率缩放']] as const).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => setBatchDurationMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  batchDurationMode === mode
                    ? 'border-blue-500/50 bg-blue-900/40 text-blue-300'
                    : 'border-zinc-700/50 bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700/60 hover:text-zinc-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">
              {batchDurationMode === 'set' ? '时长（秒）' : batchDurationMode === 'add' ? '增减量（秒，负数为减少）' : '倍率（如 1.5 表示 1.5 倍）'}
            </label>
            <GlassInput
              type="number"
              min={batchDurationMode === 'multiply' ? 0.1 : undefined}
              step={batchDurationMode === 'multiply' ? 0.1 : 0.5}
              value={batchDurationValue}
              onChange={(e) => setBatchDurationValue(e.target.value)}
              placeholder={batchDurationMode === 'set' ? '5' : batchDurationMode === 'add' ? '+1' : '1.5'}
            />
          </div>
          {batchDurationMode === 'add' && batchDurationValue && (
            <div className="text-xs text-zinc-500">
              示例：输入 <span className="text-zinc-300">-0.5</span> 表示每个分镜缩短 0.5 秒
            </div>
          )}
        </div>
      </GlassModalShell>

      {/* ── Version Diff Modal ────────────────────────── */}
      <GlassModalShell
        open={!!diffData || loadingDiff}
        onClose={() => setDiffData(null)}
        title="版本对比"
        description={diffData ? `${diffLabelA} → ${diffLabelB}` : undefined}
        size="md"
        footer={
          <div className="flex justify-end">
            <GlassButton variant="secondary" onClick={() => setDiffData(null)}>关闭</GlassButton>
          </div>
        }
      >
        {loadingDiff ? (
          <div className="text-zinc-500 text-sm py-8 text-center">加载对比数据...</div>
        ) : diffData ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {diffData.diffs.length === 0 ? (
              <div className="text-zinc-500 text-sm py-4 text-center">两个版本完全一致</div>
            ) : (
              diffData.diffs.filter(d => d.changed).map((d) => (
                <GlassSurface key={d.field} variant="card" className="p-3">
                  <div className="text-xs text-zinc-400 mb-2 font-medium">{d.label || d.field}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="text-xs text-zinc-500">{diffLabelA}</div>
                      <pre className="text-xs text-zinc-300 bg-zinc-800/60 rounded p-2 overflow-x-auto max-h-20 whitespace-pre-wrap break-all">
                        {d.value_a != null ? JSON.stringify(d.value_a, null, 2) : "(空)"}
                      </pre>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-zinc-500">{diffLabelB}</div>
                      <pre className="text-xs text-zinc-300 bg-zinc-800/60 rounded p-2 overflow-x-auto max-h-20 whitespace-pre-wrap break-all">
                        {d.value_b != null ? JSON.stringify(d.value_b, null, 2) : "(空)"}
                      </pre>
                    </div>
                  </div>
                </GlassSurface>
              ))
            )}
          </div>
        ) : null}
      </GlassModalShell>

      {/* ── Switch Locked Version Confirm Modal ────────── */}
      <GlassModalShell
        open={!!showSwitchConfirm}
        onClose={() => setShowSwitchConfirm(null)}
        title="切换锁定版本"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <GlassButton variant="secondary" onClick={() => setShowSwitchConfirm(null)}>取消</GlassButton>
            <GlassButton variant="primary" onClick={handleSwitchLocked} loading={switching}>确认切换</GlassButton>
          </div>
        }
      >
        <div className="text-sm text-zinc-400">
          确定要将锁定版本切换到 <span className="text-yellow-400 font-medium">v{showSwitchConfirm?.version_no}</span> 吗？
          <br />
          <span className="text-xs text-zinc-500 mt-2 block">
            当前锁定版本将被替换，后续合成和导出将使用新锁定的版本。
          </span>
        </div>
      </GlassModalShell>
    </div>
  )
}
