'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { GlassButton, GlassField, GlassInput, GlassModalShell, GlassSurface } from '@/components/ui/primitives'
import { apiClient, type Episode } from '@/lib/api-client'

type Props = {
  projectId: string
  episodes: Episode[]
}

const primaryBtn = 'rounded-md border border-zinc-700 bg-zinc-800/70 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-700 transition-colors'
const dangerBtn = 'rounded-md border border-red-950/50 bg-red-950/20 px-3 py-1.5 text-sm text-red-300 hover:bg-red-950/35 transition-colors'

function formatEpisodeTitle(episode: Episode) {
  const rawTitle = (episode.title || '').trim()
  const normalized = rawTitle.replace(/^第\s*\d+\s*集[:：\-\s]*/u, '').trim()
  return normalized ? `第${episode.episode_no}集：${normalized}` : `第${episode.episode_no}集`
}

export function EpisodeListManager({ projectId, episodes }: Props) {
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Episode | null>(null)
  const [submittingDelete, setSubmittingDelete] = useState(false)
  const [form, setForm] = useState({ title: '', outline: '', duration: '90' })

  const nextEpisodeNo = useMemo(() => {
    const used = new Set(episodes.map((ep) => ep.episode_no).filter(Boolean))
    let candidate = 1
    while (used.has(candidate)) candidate += 1
    return candidate
  }, [episodes])

  const handleCreate = async () => {
    try {
      setCreating(true)
      await apiClient.createEpisode({
        project_id: projectId,
        episode_no: nextEpisodeNo,
        title: form.title.trim() || `第${nextEpisodeNo}集`,
        outline: form.outline.trim() || undefined,
        duration: form.duration ? Number(form.duration) : undefined,
        status: 'draft',
      })
      setShowCreate(false)
      setForm({ title: '', outline: '', duration: '90' })
      router.refresh()
    } catch (error) {
      console.error('创建剧集失败', error)
      alert('创建剧集失败，请重试')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      setSubmittingDelete(true)
      await apiClient.deleteEpisode(deleting.id)
      setDeleting(null)
      router.refresh()
    } catch (error) {
      console.error('删除剧集失败', error)
      alert('删除剧集失败，请重试')
    } finally {
      setSubmittingDelete(false)
    }
  }

  return (
    <>
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-zinc-100">剧集列表</h3>
            <p className="mt-1 text-sm text-zinc-500">共 {episodes.length} 集，可继续新增、查看或删除剧集。</p>
          </div>
          <GlassButton variant="primary" size="md" onClick={() => setShowCreate(true)}>
            新增剧集
          </GlassButton>
        </div>

        <div className="grid gap-3">
          {episodes.map((episode) => (
            <GlassSurface key={episode.id} variant="panel" className="p-4 hover:border-zinc-700 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <Link href={`/workspace/projects/${projectId}/episodes/${episode.id}`} className="min-w-0 flex-1">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-zinc-100">{formatEpisodeTitle(episode)}</h4>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      {episode.duration ? <span>{episode.duration} 秒</span> : null}
                    </div>
                    {episode.outline && <p className="line-clamp-2 text-sm text-zinc-400">{episode.outline}</p>}
                  </div>
                </Link>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-1 text-xs ${episode.status === 'IN_PRODUCTION' ? 'bg-blue-900/30 text-blue-400' : 'bg-zinc-800 text-zinc-400'}`}>
                    {episode.status === 'IN_PRODUCTION' ? '制作中' : episode.status}
                  </span>
                  <button className={dangerBtn} onClick={() => setDeleting(episode)}>删除</button>
                </div>
              </div>
            </GlassSurface>
          ))}
        </div>
      </div>

      <GlassModalShell open={showCreate} onClose={() => !creating && setShowCreate(false)} title="新增剧集" size="md">
        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-400">将创建第 {nextEpisodeNo} 集</div>
          <GlassField label="标题">
            <GlassInput value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder={`例如：重逢`} />
          </GlassField>
          <GlassField label="概要">
            <textarea value={form.outline} onChange={(e) => setForm((f) => ({ ...f, outline: e.target.value }))} placeholder="输入本集概要" className="min-h-[120px] w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500" />
          </GlassField>
          <GlassField label="时长（秒）">
            <GlassInput type="number" min="1" value={form.duration} onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))} />
          </GlassField>
          <div className="flex justify-end gap-2">
            <button className={primaryBtn} onClick={() => setShowCreate(false)} disabled={creating}>取消</button>
            <GlassButton variant="primary" size="md" onClick={handleCreate} disabled={creating}>{creating ? '创建中...' : '确认创建'}</GlassButton>
          </div>
        </div>
      </GlassModalShell>

      <GlassModalShell open={!!deleting} onClose={() => !submittingDelete && setDeleting(null)} title="删除剧集" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">确定要删除「{deleting ? formatEpisodeTitle(deleting) : ''}」吗？此操作不可恢复。</p>
          <div className="flex justify-end gap-2">
            <button className={primaryBtn} onClick={() => setDeleting(null)} disabled={submittingDelete}>取消</button>
            <button className={dangerBtn} onClick={handleDelete} disabled={submittingDelete}>{submittingDelete ? '删除中...' : '确认删除'}</button>
          </div>
        </div>
      </GlassModalShell>
    </>
  )
}
