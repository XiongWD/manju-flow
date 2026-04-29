"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { apiClient, Episode, Project, StoryBible, Character } from "@/lib/api-client"
import GlassSurface from "@/components/ui/primitives/GlassSurface"
import GlassButton from "@/components/ui/primitives/GlassButton"
import GlassInput from "@/components/ui/primitives/GlassInput"
import GlassTextarea from "@/components/ui/primitives/GlassTextarea"
import GlassModalShell from "@/components/ui/primitives/GlassModalShell"
import GlassLoadingBlock from "@/components/ui/primitives/GlassLoadingBlock"
import GlassToastContainer from "@/components/ui/primitives/GlassToast"
import GlassEmptyState from "@/components/ui/primitives/GlassEmptyState"
import { PageHeader } from "@/components/workspace/PageHeader"

/* ── toast helper ──────────────────────────────────── */

function useToast() {
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)
  const show = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }
  return { toast, show }
}

/* ── constants ──────────────────────────────────────── */

const AVATAR_COLORS = [
  "from-violet-500 to-fuchsia-500",
  "from-cyan-500 to-blue-500",
  "from-amber-500 to-orange-500",
  "from-emerald-500 to-teal-500",
  "from-rose-500 to-pink-500",
  "from-indigo-500 to-purple-500",
]

const ROLE_OPTIONS = [
  { value: "protagonist", label: "主角", tone: "info" },
  { value: "supporting", label: "配角", tone: "success" },
  { value: "antagonist", label: "反派", tone: "danger" },
] as const

const ROLE_TONE_CLASSES: Record<string, string> = {
  info: "bg-blue-900/40 text-blue-300",
  danger: "bg-red-900/40 text-red-300",
  success: "bg-green-900/40 text-green-300",
}

/* ── helpers ────────────────────────────────────────── */

function pickAvatarColor(index: number) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length]
}

function getRoleInfo(roleType?: string) {
  return ROLE_OPTIONS.find((r) => r.value === roleType) ?? ROLE_OPTIONS[1]
}

/* ── Asset picker types ──────────────────────────── */

type AssetItem = { id: string; type: string; uri?: string; mime_type?: string }

/* ── page ────────────────────────────────────────────── */

export default function StoryCharactersPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  /* state */
  const [project, setProject] = useState<Project | null>(null)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [bibles, setBibles] = useState<StoryBible[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [scenes, setScenes] = useState<Map<string, { id: string; scene_no: number; title?: string; character_ids?: string[] }>[]>([])
  const [selectedEpId, setSelectedEpId] = useState<string | null>(null)
  const [expandedEp, setExpandedEp] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // asset picker state
  const [showAssetPicker, setShowAssetPicker] = useState(false)
  const [assetPickerTarget, setAssetPickerTarget] = useState<string | null>(null) // character id
  const [projectAssets, setProjectAssets] = useState<AssetItem[]>([])
  const [assetsLoading, setAssetsLoading] = useState(false)
  const [assetPreviewMap, setAssetPreviewMap] = useState<Record<string, string>>({})

  // story bible modal
  const [showBibleModal, setShowBibleModal] = useState(false)
  const [editBibleId, setEditBibleId] = useState<string | null>(null)
  const [bibleForm, setBibleForm] = useState({ title: "", summary: "", theme: "", conflict: "", content: "" })
  const [bibleSaving, setBibleSaving] = useState(false)
  const [bibleError, setBibleError] = useState("")

  // character modal
  const [showCharModal, setShowCharModal] = useState(false)
  const [editCharId, setEditCharId] = useState<string | null>(null)
  const [charForm, setCharForm] = useState({ name: "", role_type: "protagonist", description: "", episode_ids: [] as string[] })
  const [charSaving, setCharSaving] = useState(false)
  const [charError, setCharError] = useState("")

  // delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string; type: "bible" | "character" } | null>(null)
  const [deleting, setDeleting] = useState(false)

  // toast
  const { toast, show: showToast } = useToast()

  /* data fetching */
  const fetchProject = useCallback(async () => {
    const p = await apiClient.getProject(projectId)
    setProject(p)
  }, [projectId])

  const fetchEpisodes = useCallback(async () => {
    const eps = await apiClient.listEpisodes({ project_id: projectId })
    setEpisodes(eps)
    if (eps.length > 0) setSelectedEpId((prev) => prev ?? eps[0].id)
  }, [projectId])

  const fetchBibles = useCallback(async () => {
    const list = await apiClient.listStoryBibles(projectId)
    setBibles(list)
  }, [projectId])

  const fetchCharacters = useCallback(async () => {
    const list = await apiClient.listCharacters(projectId)
    setCharacters(list)
  }, [projectId])

  const fetchScenes = useCallback(async () => {
    const allScenes: Map<string, { id: string; scene_no: number; title?: string; character_ids?: string[] }>[] = []
    for (const ep of episodes) {
      const epScenes = await apiClient.listScenes({ episode_id: ep.id })
      allScenes.push(new Map(epScenes.map(s => [s.id, s])))
    }
    setScenes(allScenes)
  }, [episodes])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await Promise.all([fetchProject(), fetchEpisodes(), fetchBibles(), fetchCharacters()])
      } catch { /* empty */ }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [fetchProject, fetchEpisodes, fetchBibles, fetchCharacters])

  useEffect(() => {
    if (episodes.length > 0 && !loading) {
      fetchScenes().catch(() => {})
    }
  }, [episodes.length, loading, fetchScenes])

  // Load avatar previews for characters that have canonical_asset_id
  useEffect(() => {
    if (characters.length === 0) return
    const charsWithAvatar = characters.filter(c => c.canonical_asset_id && !assetPreviewMap[c.canonical_asset_id])
    if (charsWithAvatar.length === 0) return
    ;(async () => {
      const previews: Record<string, string> = {}
      await Promise.allSettled(
        charsWithAvatar.map(async (c) => {
          try {
            const preview = await apiClient.getAssetPreview(c.canonical_asset_id!)
            if (preview.url) previews[c.canonical_asset_id!] = preview.url
          } catch { /* skip */ }
        })
      )
      setAssetPreviewMap(prev => ({ ...prev, ...previews }))
    })()
  }, [characters])

  // Build a flat scene-by-episode map for lookups
  const scenesByEpisode = useMemo(() => {
    const m = new Map<string, typeof scenes[number]>()
    episodes.forEach((ep, idx) => {
      if (scenes[idx]) m.set(ep.id, scenes[idx])
    })
    return m
  }, [episodes, scenes])

  const selectedEp = episodes.find((e) => e.id === selectedEpId)
  const selectedEpScenes = selectedEp ? scenesByEpisode.get(selectedEp.id) : undefined

  // episode characters for expanded view
  const [epCharacters, setEpCharacters] = useState<Character[]>([])
  const epCharsMap = useMemo(() => {
    const m = new Map<string, Character[]>()
    characters.forEach((c) => {
      ;(c.episode_ids ?? []).forEach((eid) => {
        if (!m.has(eid)) m.set(eid, [])
        m.get(eid)!.push(c)
      })
    })
    return m
  }, [characters])

  useEffect(() => {
    if (expandedEp) {
      const cached = epCharsMap.get(expandedEp)
      if (cached) {
        setEpCharacters(cached)
      } else {
        apiClient.listCharactersByEpisode(expandedEp).then(setEpCharacters).catch(() => setEpCharacters([]))
      }
    }
  }, [expandedEp, epCharsMap])

  /* ── story bible CRUD ──────────────────────────────── */

  const openCreateBible = () => {
    setEditBibleId(null)
    setBibleForm({ title: "", summary: "", theme: "", conflict: "", content: "" })
    setBibleError("")
    setShowBibleModal(true)
  }

  const openEditBible = (b: StoryBible) => {
    setEditBibleId(b.id)
    setBibleForm({
      title: b.title ?? "",
      summary: b.summary ?? "",
      theme: b.theme ?? "",
      conflict: b.conflict ?? "",
      content: b.content ?? "",
    })
    setBibleError("")
    setShowBibleModal(true)
  }

  const handleSaveBible = async () => {
    setBibleError("")
    if (!bibleForm.title.trim()) {
      setBibleError("标题不能为空")
      return
    }
    if (bibleForm.title.trim().length > 100) {
      setBibleError("标题不能超过 100 个字符")
      return
    }
    setBibleSaving(true)
    try {
      const payload = {
        title: bibleForm.title,
        summary: bibleForm.summary || undefined,
        theme: bibleForm.theme || undefined,
        conflict: bibleForm.conflict || undefined,
        content: bibleForm.content || undefined,
      }
      if (editBibleId) {
        const updated = await apiClient.updateStoryBible(editBibleId, payload)
        setBibles((prev) => prev.map((b) => (b.id === editBibleId ? updated : b)))
        showToast("故事圣经已更新")
      } else {
        const created = await apiClient.createStoryBible({ project_id: projectId, ...payload })
        setBibles((prev) => [...prev, created])
        showToast("故事圣经已创建")
      }
      setShowBibleModal(false)
    } catch {
      showToast("保存失败，请稍后重试", "error")
    }
    setBibleSaving(false)
  }

  const handleDeleteBible = (id: string, label: string) => {
    setDeleteTarget({ id, label: label || "故事圣经", type: "bible" })
  }

  /* ── asset picker ────────────────────────────────── */

  const openAssetPicker = async (charId: string) => {
    setAssetPickerTarget(charId)
    setShowAssetPicker(true)
    setAssetsLoading(true)
    try {
      const assets = await apiClient.listAssets({ project_id: projectId, limit: 100 })
      // Filter to image-like assets for avatar selection
      const imageAssets = assets.filter(a =>
        a.type === 'character_ref' || a.type === 'image' ||
        a.mime_type?.startsWith('image/')
      )
      setProjectAssets(imageAssets)
      // Load previews for image assets
      const previews: Record<string, string> = {}
      await Promise.allSettled(
        imageAssets.slice(0, 20).map(async (a) => {
          try {
            const preview = await apiClient.getAssetPreview(a.id)
            if (preview.url) previews[a.id] = preview.url
          } catch { /* skip */ }
        })
      )
      setAssetPreviewMap(prev => ({ ...prev, ...previews }))
    } catch {
      setProjectAssets([])
    }
    setAssetsLoading(false)
  }

  const handleAssetSelect = async (assetId: string) => {
    if (!assetPickerTarget) return
    try {
      const updated = await apiClient.updateCharacter(assetPickerTarget, { canonical_asset_id: assetId })
      setCharacters(prev => prev.map(c => c.id === assetPickerTarget ? updated : c))
      showToast("角色头像已更新")
    } catch {
      showToast("设置头像失败", "error")
    }
    setShowAssetPicker(false)
    setAssetPickerTarget(null)
  }

  const handleClearAvatar = async (charId: string) => {
    try {
      const updated = await apiClient.updateCharacter(charId, { canonical_asset_id: "" })
      setCharacters(prev => prev.map(c => c.id === charId ? updated : c))
      showToast("角色头像已清除")
    } catch {
      showToast("清除头像失败", "error")
    }
  }

  /* ── scene-character association ────────────────────── */

  const updateSceneCharacters = async (sceneId: string, characterIds: string[], epId: string) => {
    try {
      await apiClient.updateScene(sceneId, { character_ids: characterIds })
      // Refresh scenes for this episode
      const epScenes = await apiClient.listScenes({ episode_id: epId })
      setScenes(prev => {
        const next = [...prev]
        const epIdx = episodes.findIndex(e => e.id === epId)
        if (epIdx >= 0) next[epIdx] = new Map(epScenes.map(s => [s.id, s]))
        return next
      })
      showToast("场景角色已更新")
    } catch {
      showToast("更新场景角色失败", "error")
    }
  }

  const toggleSceneCharacter = (sceneId: string, charId: string, epId: string) => {
    const sceneMap = scenesByEpisode.get(epId)
    if (!sceneMap) return
    const scene = sceneMap.get(sceneId)
    if (!scene) return
    const currentIds = scene.character_ids ?? []
    const newIds = currentIds.includes(charId)
      ? currentIds.filter(id => id !== charId)
      : [...currentIds, charId]
    updateSceneCharacters(sceneId, newIds, epId)
  }

  /* ── character CRUD ────────────────────────────────── */

  const openCreateChar = () => {
    setEditCharId(null)
    setCharForm({ name: "", role_type: "protagonist", description: "", episode_ids: [] })
    setCharError("")
    setShowCharModal(true)
  }

  const openEditChar = (c: Character) => {
    setEditCharId(c.id)
    setCharForm({
      name: c.name,
      role_type: c.role_type ?? "supporting",
      description: c.description ?? "",
      episode_ids: c.episode_ids ?? [],
    })
    setCharError("")
    setShowCharModal(true)
  }

  const handleSaveChar = async () => {
    setCharError("")
    if (!charForm.name.trim()) {
      setCharError("姓名不能为空")
      return
    }
    if (charForm.name.trim().length > 50) {
      setCharError("姓名不能超过 50 个字符")
      return
    }
    setCharSaving(true)
    try {
      const payload = {
        name: charForm.name,
        role_type: charForm.role_type || undefined,
        description: charForm.description || undefined,
        episode_ids: charForm.episode_ids.length > 0 ? charForm.episode_ids : undefined,
      }
      if (editCharId) {
        const updated = await apiClient.updateCharacter(editCharId, payload)
        setCharacters((prev) => prev.map((c) => (c.id === editCharId ? updated : c)))
        showToast("角色信息已更新")
      } else {
        const created = await apiClient.createCharacter({ project_id: projectId, ...payload })
        setCharacters((prev) => [...prev, created])
        showToast("角色已创建")
      }
      setShowCharModal(false)
    } catch {
      showToast("保存失败，请稍后重试", "error")
    }
    setCharSaving(false)
  }

  const handleDeleteChar = (id: string, label: string) => {
    setDeleteTarget({ id, label, type: "character" })
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      if (deleteTarget.type === "bible") {
        await apiClient.deleteStoryBible(deleteTarget.id)
        setBibles((prev) => prev.filter((b) => b.id !== deleteTarget.id))
        showToast("故事圣经已删除")
      } else {
        await apiClient.deleteCharacter(deleteTarget.id)
        setCharacters((prev) => prev.filter((c) => c.id !== deleteTarget.id))
        showToast("角色已删除")
      }
    } catch {
      showToast("删除失败，请稍后重试", "error")
    }
    setDeleting(false)
    setDeleteTarget(null)
  }

  /* toggle episode in char form */
  const toggleEpisodeInForm = (epId: string) => {
    setCharForm((prev) => ({
      ...prev,
      episode_ids: prev.episode_ids.includes(epId)
        ? prev.episode_ids.filter((id) => id !== epId)
        : [...prev.episode_ids, epId],
    }))
  }

  /* three-act structure */
  const third = Math.ceil(episodes.length / 3)
  const act1 = episodes.slice(0, third)
  const act2 = episodes.slice(third, third * 2)
  const act3 = episodes.slice(third * 2)

  /* ── render ────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 p-4 md:p-6 lg:p-8">
        <GlassLoadingBlock message="正在加载故事与角色数据…" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <button
          onClick={() => router.push("/workspace/story")}
          className="mb-3 inline-block text-sm text-zinc-400 transition-colors hover:text-zinc-200"
        >
          ← 返回故事与角色
        </button>
        <PageHeader
          title="故事与角色"
          description="管理故事圣经、角色设定、剧集关联与场景角色关系。"
        />
      </div>

      <div className="space-y-6">
        {/* ── Project Overview ──────────────────────────── */}
        <GlassSurface variant="elevated" className="p-6">
          <h2 className="text-lg font-semibold text-zinc-100 mb-3">项目概览</h2>
          {project ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-zinc-500 mb-1">项目名称</div>
                  <div className="text-sm text-zinc-200">{project.name}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">题材</div>
                  <div className="text-sm text-zinc-200">{project.genre || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">平台</div>
                  <div className="text-sm text-zinc-200">{project.platform || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">状态</div>
                  <div className="text-sm text-zinc-200">{project.status}</div>
                </div>
              </div>
              {project.description && (
                <p className="text-sm text-zinc-400 leading-relaxed pt-2 border-t border-zinc-800/50">
                  {project.description}
                </p>
              )}
            </div>
          ) : (
            <p className="text-zinc-500 text-sm">无法加载项目信息</p>
          )}
        </GlassSurface>

        {/* ── Story Bible ──────────────────────────────── */}
        <GlassSurface variant="panel" className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-zinc-100">故事圣经</h2>
            <GlassButton variant="primary" size="sm" onClick={openCreateBible}>
              + 新建
            </GlassButton>
          </div>

          {bibles.length === 0 ? (
            <GlassEmptyState compact title="暂无故事圣经" description="点击右上角新建，开始整理剧情设定、主题与冲突。" />
          ) : (
            <div className="space-y-3">
              {bibles.map((bible, idx) => (
                <div
                  key={bible.id}
                  className="group relative rounded-lg border border-zinc-800/50 bg-zinc-900/40 p-4 hover:border-zinc-700/60 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-zinc-500 font-mono">v{bible.version}</span>
                        <h3 className="text-sm font-semibold text-zinc-200 truncate">
                          {bible.title || `故事圣经 #${idx + 1}`}
                        </h3>
                      </div>
                      {/* Structured fields: summary / theme / conflict */}
                      {(bible.summary || bible.theme || bible.conflict) && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {bible.summary && (
                            <span className="inline-flex items-center gap-1 text-xs bg-zinc-800/60 text-zinc-300 px-2 py-1 rounded-md">
                              <span className="text-zinc-500">摘要</span>
                              {bible.summary}
                            </span>
                          )}
                          {bible.theme && (
                            <span className="inline-flex items-center gap-1 text-xs bg-violet-900/30 text-violet-300 px-2 py-1 rounded-md">
                              <span className="text-violet-500">主题</span>
                              {bible.theme}
                            </span>
                          )}
                          {bible.conflict && (
                            <span className="inline-flex items-center gap-1 text-xs bg-amber-900/30 text-amber-300 px-2 py-1 rounded-md">
                              <span className="text-amber-500">冲突</span>
                              {bible.conflict}
                            </span>
                          )}
                        </div>
                      )}
                      {bible.content && (
                        <p className="text-sm text-zinc-400 leading-relaxed line-clamp-3">
                          {bible.content}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={() => openEditBible(bible)}
                        className="p-1.5 rounded-md bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 transition-colors"
                        title="编辑"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteBible(bible.id, bible.title || `故事圣经 #${idx + 1}`)}
                        className="p-1.5 rounded-md bg-zinc-800/80 text-zinc-400 hover:text-red-400 transition-colors"
                        title="删除"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassSurface>

        {/* ── Characters ──────────────────────────────── */}
        <GlassSurface variant="panel" className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-zinc-100">角色管理</h2>
            <GlassButton variant="primary" size="sm" onClick={openCreateChar}>
              + 添加角色
            </GlassButton>
          </div>

          {characters.length === 0 ? (
            <GlassEmptyState compact title="暂无角色" description="点击右上角添加角色，补齐主角、配角与反派设定。" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {characters.map((char, idx) => {
                const roleInfo = getRoleInfo(char.role_type)
                const charEps = (char.episode_ids ?? [])
                  .map((eid) => episodes.find((ep) => ep.id === eid))
                  .filter(Boolean) as Episode[]
                return (
                  <GlassSurface key={char.id} variant="card" className="p-4 relative group">
                    <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditChar(char)}
                        className="p-1.5 rounded-md bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 transition-colors"
                        title="编辑"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteChar(char.id, char.name)}
                        className="p-1.5 rounded-md bg-zinc-800/80 text-zinc-400 hover:text-red-400 transition-colors"
                        title="删除"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      {/* Avatar: show asset preview if canonical_asset_id set, otherwise gradient */}
                      {char.canonical_asset_id && assetPreviewMap[char.canonical_asset_id] ? (
                        <div className="relative group/avatar flex-shrink-0">
                          <img
                            src={assetPreviewMap[char.canonical_asset_id]}
                            alt={char.name}
                            className="w-12 h-12 rounded-full object-cover ring-2 ring-zinc-700/50"
                          />
                          <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              onClick={() => openAssetPicker(char.id)}
                              className="text-white text-[10px] hover:text-blue-300"
                              title="更换头像"
                            >↻</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => openAssetPicker(char.id)}
                          className={`w-12 h-12 rounded-full bg-gradient-to-br ${pickAvatarColor(idx)} flex items-center justify-center text-white font-bold text-lg flex-shrink-0 hover:ring-2 hover:ring-blue-500/40 transition-all`}
                          title="选择头像"
                        >
                          {char.name.charAt(0)}
                        </button>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-zinc-100 truncate">{char.name}</h3>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_TONE_CLASSES[roleInfo.tone]}`}>
                          {roleInfo.label}
                        </span>
                      </div>
                    </div>

                    {char.description && (
                      <p className="text-sm text-zinc-400 leading-relaxed mb-2">{char.description}</p>
                    )}

                    {/* Associated episodes */}
                    {charEps.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {charEps.map((ep) => (
                          <span key={ep.id} className="text-xs bg-zinc-800/60 text-zinc-400 px-1.5 py-0.5 rounded">
                            E{ep.episode_no}
                          </span>
                        ))}
                      </div>
                    )}
                  </GlassSurface>
                )
              })}
            </div>
          )}
        </GlassSurface>

        {/* ── Episode List ──────────────────────────────── */}
        {episodes.length > 0 && (
          <GlassSurface variant="panel" className="p-6">
            <h2 className="text-lg font-semibold text-zinc-100 mb-4">剧集列表</h2>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin mb-4">
              {episodes.map((ep) => (
                <button
                  key={ep.id}
                  onClick={() => {
                    setSelectedEpId(ep.id)
                    setExpandedEp(expandedEp === ep.id ? null : ep.id)
                  }}
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

            {selectedEp && expandedEp === selectedEp.id && (
              <div className="mt-2 p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50 space-y-3">
                <h3 className="text-sm font-medium text-zinc-200">
                  第 {selectedEp.episode_no} 集 — {selectedEp.title || "无标题"}
                </h3>
                {selectedEp.outline && (
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">大纲</div>
                    <p className="text-sm text-zinc-400 leading-relaxed">{selectedEp.outline}</p>
                  </div>
                )}
                {selectedEp.script && (
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">剧本</div>
                    <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {selectedEp.script}
                    </p>
                  </div>
                )}
                {/* Scene-character association table */}
                {selectedEpScenes && selectedEpScenes.size > 0 && (
                  <div>
                    <div className="text-xs text-zinc-500 mb-2">场景角色关联</div>
                    <div className="space-y-2">
                      {Array.from(selectedEpScenes.values()).map(scene => {
                        const sceneChars = (scene.character_ids ?? [])
                          .map(cid => characters.find(c => c.id === cid))
                          .filter(Boolean) as Character[]
                        return (
                          <div key={scene.id} className="flex items-center gap-2 text-sm">
                            <span className="text-xs text-zinc-500 font-mono w-8 flex-shrink-0">S{scene.scene_no}</span>
                            <span className="text-zinc-400 truncate w-24 flex-shrink-0">{scene.title || "—"}</span>
                            <div className="flex flex-wrap gap-1 flex-1">
                              {sceneChars.length > 0 ? sceneChars.map(c => (
                                <span key={c.id} className="inline-flex items-center gap-1 text-xs bg-blue-900/30 text-blue-300 px-1.5 py-0.5 rounded cursor-pointer hover:bg-blue-900/50 transition-colors"
                                  onClick={() => toggleSceneCharacter(scene.id, c.id, selectedEp.id)}
                                  title="点击移除"
                                >
                                  {c.name} ×
                                </span>
                              )) : <span className="text-xs text-zinc-600">未分配角色</span>}
                              {/* Add character dropdown */}
                              {characters.length > 0 && (
                                <select
                                  value=""
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      toggleSceneCharacter(scene.id, e.target.value, selectedEp.id)
                                    }
                                  }}
                                  className="text-xs bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 rounded px-1.5 py-0.5 h-5 focus:outline-none focus:border-blue-500/50"
                                >
                                  <option value="">+ 角色</option>
                                  {characters
                                    .filter(c => !(scene.character_ids ?? []).includes(c.id))
                                    .map(c => (
                                      <option key={c.id} value={c.id}>{c.name}</option>
                                    ))
                                  }
                                </select>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {/* Episode characters */}
                {epCharacters.length > 0 && (
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">出场角色</div>
                    <div className="flex flex-wrap gap-2">
                      {epCharacters.map((c) => (
                        <span key={c.id} className="inline-flex items-center gap-1.5 text-xs bg-zinc-800/60 text-zinc-300 px-2 py-1 rounded-md">
                          {c.canonical_asset_id && assetPreviewMap[c.canonical_asset_id] ? (
                            <img src={assetPreviewMap[c.canonical_asset_id]} alt={c.name} className="w-4 h-4 rounded-full object-cover" />
                          ) : (
                            <span className="w-4 h-4 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-[9px] font-bold">
                              {c.name.charAt(0)}
                            </span>
                          )}
                          {c.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {!selectedEp.outline && !selectedEp.script && epCharacters.length === 0 && (!selectedEpScenes || selectedEpScenes.size === 0) && (
                  <p className="text-zinc-500 text-sm">该集暂无大纲和剧本</p>
                )}
              </div>
            )}
          </GlassSurface>
        )}

        {/* ── Three-Act Structure ──────────────────────── */}
        {episodes.length > 0 && (
          <GlassSurface variant="panel" className="p-6">
            <h2 className="text-lg font-semibold text-zinc-100 mb-4">故事线概览 — 三幕结构</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {([
                { title: "第一幕：建制", subtitle: "Act 1 — Setup", eps: act1, accent: "border-l-blue-500" },
                { title: "第二幕：对抗", subtitle: "Act 2 — Confrontation", eps: act2, accent: "border-l-amber-500" },
                { title: "第三幕：解决", subtitle: "Act 3 — Resolution", eps: act3, accent: "border-l-emerald-500" },
              ] as const).map((act) => (
                <div key={act.subtitle} className={`rounded-lg border border-zinc-800/50 border-l-2 ${act.accent} p-4`}>
                  <h3 className="text-sm font-semibold text-zinc-200 mb-0.5">{act.title}</h3>
                  <p className="text-xs text-zinc-500 mb-3">{act.subtitle}</p>
                  {act.eps.length > 0 ? (
                    <div className="space-y-1.5">
                      {act.eps.map((ep) => {
                        const epChars = epCharsMap.get(ep.id) ?? []
                        return (
                          <div key={ep.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs text-zinc-500 font-mono w-6 flex-shrink-0">E{ep.episode_no}</span>
                              <span className="text-zinc-300 truncate">{ep.title || "无标题"}</span>
                            </div>
                            {epChars.length > 0 && (
                              <div className="flex -space-x-1 flex-shrink-0 ml-1">
                                {epChars.slice(0, 3).map((c) => (
                                  <span key={c.id} className="w-4 h-4 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white text-[8px] font-bold ring-1 ring-zinc-900">
                                    {c.name.charAt(0)}
                                  </span>
                                ))}
                                {epChars.length > 3 && (
                                  <span className="text-[8px] text-zinc-500 ml-0.5">+{epChars.length - 3}</span>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-600">暂无剧集</p>
                  )}
                </div>
              ))}
            </div>
          </GlassSurface>
        )}
      </div>

      {/* ── Story Bible Modal ──────────────────────────── */}
      <GlassModalShell
        open={showBibleModal}
        onClose={() => setShowBibleModal(false)}
        title={editBibleId ? "编辑故事圣经" : "新建故事圣经"}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <GlassButton variant="secondary" onClick={() => setShowBibleModal(false)}>取消</GlassButton>
            <GlassButton variant="primary" onClick={handleSaveBible} disabled={bibleSaving}>
              {bibleSaving ? "保存中..." : "保存"}
            </GlassButton>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">标题 *</label>
            <GlassInput
              value={bibleForm.title}
              onChange={(e) => { setBibleForm({ ...bibleForm, title: e.target.value }); setBibleError("") }}
              placeholder="如：世界观设定、角色关系图、时间线"
            />
            {bibleError && <p className="mt-1 text-xs text-red-400">{bibleError}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">一句话摘要</label>
              <GlassInput
                value={bibleForm.summary}
                onChange={(e) => setBibleForm({ ...bibleForm, summary: e.target.value })}
                placeholder="故事核心概括"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">核心主题</label>
              <GlassInput
                value={bibleForm.theme}
                onChange={(e) => setBibleForm({ ...bibleForm, theme: e.target.value })}
                placeholder="如：复仇、成长、救赎"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">核心冲突</label>
            <GlassInput
              value={bibleForm.conflict}
              onChange={(e) => setBibleForm({ ...bibleForm, conflict: e.target.value })}
              placeholder="主要矛盾与冲突"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">内容</label>
            <GlassTextarea
              value={bibleForm.content}
              onChange={(e) => setBibleForm({ ...bibleForm, content: e.target.value })}
              placeholder="故事圣经正文内容..."
              rows={8}
            />
          </div>
        </div>
      </GlassModalShell>

      {/* ── Character Modal ────────────────────────────── */}
      <GlassModalShell
        open={showCharModal}
        onClose={() => setShowCharModal(false)}
        title={editCharId ? "编辑角色" : "添加角色"}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <GlassButton variant="secondary" onClick={() => setShowCharModal(false)}>取消</GlassButton>
            <GlassButton variant="primary" onClick={handleSaveChar} disabled={charSaving}>
              {charSaving ? "保存中..." : "保存"}
            </GlassButton>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">姓名 *</label>
            <GlassInput
              value={charForm.name}
              onChange={(e) => { setCharForm({ ...charForm, name: e.target.value }); setCharError("") }}
              placeholder="角色姓名"
            />
            {charError && <p className="mt-1 text-xs text-red-400">{charError}</p>}
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">角色类型</label>
            <select
              value={charForm.role_type}
              onChange={(e) => setCharForm({ ...charForm, role_type: e.target.value })}
              className="glass-input-base h-10 px-3 text-sm leading-5 w-full rounded-md border border-zinc-700/50 bg-zinc-800/50 text-zinc-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 focus:outline-none"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">描述</label>
            <GlassTextarea
              value={charForm.description}
              onChange={(e) => setCharForm({ ...charForm, description: e.target.value })}
              placeholder="角色简述"
              rows={3}
            />
          </div>
          {/* Episode association */}
          {episodes.length > 0 && (
            <div>
              <label className="text-xs text-zinc-500 mb-2 block">关联剧集</label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {episodes.map((ep) => {
                  const selected = charForm.episode_ids.includes(ep.id)
                  return (
                    <button
                      key={ep.id}
                      onClick={() => toggleEpisodeInForm(ep.id)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        selected
                          ? "bg-blue-600/30 text-blue-300 border border-blue-500/40"
                          : "bg-zinc-800/60 text-zinc-500 border border-zinc-700/50 hover:text-zinc-300"
                      }`}
                    >
                      E{ep.episode_no}{ep.title ? ` · ${ep.title}` : ""}
                    </button>
                  )
                })}
              </div>
              {charForm.episode_ids.length > 0 && (
                <p className="mt-1 text-xs text-zinc-600">已选 {charForm.episode_ids.length} 集</p>
              )}
            </div>
          )}
        </div>
      </GlassModalShell>

      {/* ── Asset Picker Modal ────────────────────────── */}
      <GlassModalShell
        open={showAssetPicker}
        onClose={() => { setShowAssetPicker(false); setAssetPickerTarget(null) }}
        title="选择角色头像"
        size="md"
        footer={
          <div className="flex justify-between">
            <GlassButton variant="secondary" size="sm" onClick={() => { if (assetPickerTarget) handleClearAvatar(assetPickerTarget) }}>
              清除头像
            </GlassButton>
            <GlassButton variant="secondary" onClick={() => { setShowAssetPicker(false); setAssetPickerTarget(null) }}>关闭</GlassButton>
          </div>
        }
      >
        <div className="space-y-3">
          {assetsLoading ? (
            <div className="text-center py-8 text-zinc-500 text-sm">正在加载项目资产...</div>
          ) : projectAssets.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-zinc-500 text-sm">暂无图片资产</p>
              <p className="text-zinc-600 text-xs mt-1">请先上传角色参考图</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
              {projectAssets.map(asset => (
                <button
                  key={asset.id}
                  onClick={() => handleAssetSelect(asset.id)}
                  className={`aspect-square rounded-lg overflow-hidden border-2 transition-all hover:ring-2 hover:ring-blue-500/50 ${
                    assetPickerTarget && characters.find(c => c.id === assetPickerTarget)?.canonical_asset_id === asset.id
                      ? 'border-blue-500 ring-2 ring-blue-500/30'
                      : 'border-zinc-700/50'
                  }`}
                >
                  {assetPreviewMap[asset.id] ? (
                    <img src={assetPreviewMap[asset.id]} alt={asset.type} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-600 text-xs">
                      {asset.type}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </GlassModalShell>

      {/* ── Delete Confirmation Modal ──────────────────── */}
      <GlassModalShell
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="确认删除"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <GlassButton variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>取消</GlassButton>
            <GlassButton variant="primary" onClick={confirmDelete} disabled={deleting} className="!bg-red-600 hover:!bg-red-500">
              {deleting ? "删除中..." : "确认删除"}
            </GlassButton>
          </div>
        }
      >
        <p className="text-sm text-zinc-300">
          确定要删除「{deleteTarget?.label}」吗？此操作不可撤销。
        </p>
      </GlassModalShell>

      <GlassToastContainer toasts={toast ? [{ id: 'story-toast', message: toast.message, type: toast.type }] : []} />
    </div>
  )
}
