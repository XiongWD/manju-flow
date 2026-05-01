'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart3,
  Eye,
  TrendingUp,
  Heart,
  MessageCircle,
  Share2,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Layers,
  Zap,
  RefreshCw,
} from 'lucide-react'
import { GlassSurface } from '@/components/ui/primitives'
import { PageHeader } from '@/components/workspace/PageHeader'
import { apiClient, Project, Episode, EpisodeAnalyticsSummary, AnalyticsSnapshot } from '@/lib/api-client'

/* ─── Helpers ─── */

function fmt(n: number | null | undefined, unit?: string): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M${unit ?? ''}`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K${unit ?? ''}`
  return `${n}${unit ?? ''}`
}

function fmtRate(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${v.toFixed(1)}%`
}

function fmtWatchTime(seconds: number | null | undefined): string {
  if (seconds == null) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/* ─── Components ─── */

function ChangeIndicator({ value }: { value: number }) {
  if (value > 0) return <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-400"><ArrowUpRight className="h-3 w-3" />{value}%</span>
  if (value < 0) return <span className="inline-flex items-center gap-0.5 text-xs font-medium text-rose-400"><ArrowDownRight className="h-3 w-3" />{Math.abs(value)}%</span>
  return <span className="inline-flex items-center gap-0.5 text-xs font-medium text-zinc-400"><Minus className="h-3 w-3" />0%</span>
}

/* ─── Page ─── */

export default function AnalyticsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string>('')
  const [summary, setSummary] = useState<EpisodeAnalyticsSummary | null>(null)
  const [snapshots, setSnapshots] = useState<AnalyticsSnapshot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 加载项目列表
  useEffect(() => {
    apiClient.listProjects({ limit: 100 }).then(res => setProjects(res.items)).catch(() => {})
  }, [])

  // 选择项目后加载集数
  useEffect(() => {
    if (!selectedProjectId) { setEpisodes([]); setSelectedEpisodeId(''); return }
    apiClient.listEpisodes({ project_id: selectedProjectId, limit: 100 })
      .then(res => setEpisodes(res.items))
      .catch(() => setEpisodes([]))
  }, [selectedProjectId])

  // 加载分析数据
  const loadAnalytics = useCallback(async () => {
    if (!selectedEpisodeId) { setSummary(null); setSnapshots([]); return }
    setLoading(true)
    setError(null)
    try {
      const [sum, snaps] = await Promise.all([
        apiClient.getEpisodeAnalytics(selectedEpisodeId),
        apiClient.listAnalyticsSnapshots({ episode_id: selectedEpisodeId, page_size: 50 }),
      ])
      setSummary(sum)
      setSnapshots(snaps.items)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [selectedEpisodeId])

  useEffect(() => { loadAnalytics() }, [loadAnalytics])

  const snap = summary?.latest_snapshot
  const agg = (summary?.aggregation ?? {}) as Record<string, number | null>

  // 按平台汇总快照
  const platformMap: Record<string, AnalyticsSnapshot[]> = {}
  for (const s of snapshots) {
    const p = s.platform ?? '未知'
    if (!platformMap[p]) platformMap[p] = []
    platformMap[p].push(s)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 space-y-6">
      <PageHeader
        title="数据分析"
        description="选择项目和集数，查看真实播放表现与内容洞察。"
        actions={
          <button
            onClick={loadAnalytics}
            disabled={loading || !selectedEpisodeId}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        }
      />

      {/* ── 筛选器 ── */}
      <GlassSurface variant="card" padded={false} className="p-4 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500">项目</label>
          <select
            value={selectedProjectId}
            onChange={e => { setSelectedProjectId(e.target.value); setSelectedEpisodeId('') }}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
          >
            <option value="">— 选择项目 —</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500">集数</label>
          <select
            value={selectedEpisodeId}
            onChange={e => setSelectedEpisodeId(e.target.value)}
            disabled={!selectedProjectId}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 disabled:opacity-40"
          >
            <option value="">— 选择集数 —</option>
            {episodes.map(ep => <option key={ep.id} value={ep.id}>{ep.title ?? `第 ${ep.episode_no} 集`}</option>)}
          </select>
        </div>
        {snap && (
          <span className="ml-auto text-xs text-zinc-600">
            最新快照：{new Date(snap.snapshot_at).toLocaleDateString('zh-CN')}
          </span>
        )}
      </GlassSurface>

      {/* ── 空状态 ── */}
      {!selectedEpisodeId && (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
          <BarChart3 className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm">请先选择项目和集数</p>
        </div>
      )}

      {/* ── 错误 ── */}
      {error && (
        <div className="rounded-lg bg-red-950/40 border border-red-800/40 px-4 py-3 flex items-center gap-2 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {selectedEpisodeId && !loading && summary && (
        <>
          {/* ── 指标卡 ── */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {[
              { label: '总播放量', value: fmt(agg.total_views ?? snap?.views), icon: Eye },
              { label: '平均完播率', value: fmtRate(agg.avg_completion_rate ?? snap?.completion_rate), icon: TrendingUp },
              { label: '点赞数', value: fmt(agg.total_likes ?? snap?.likes), icon: Heart },
              { label: '评论数', value: fmt(agg.total_comments ?? snap?.comments), icon: MessageCircle },
              { label: '分享数', value: fmt(agg.total_shares ?? snap?.shares), icon: Share2 },
              { label: '总观看时长', value: fmtWatchTime(agg.total_watch_time ?? snap?.watch_time), icon: Clock },
            ].map((m) => {
              const Icon = m.icon
              return (
                <GlassSurface key={m.label} variant="card" padded={false} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.04]">
                      <Icon className="h-4 w-4 text-white/50" />
                    </div>
                  </div>
                  <div className="text-xl font-semibold text-white">{m.value}</div>
                  <div className="text-[11px] text-zinc-500 mt-1">{m.label}</div>
                </GlassSurface>
              )
            })}
          </div>

          {/* ── 平台表现 ── */}
          {Object.keys(platformMap).length > 0 && (
            <GlassSurface variant="panel">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-4 w-4 text-white/40" />
                <h2 className="text-sm font-semibold text-white">平台表现对比（最新快照）</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-zinc-500">
                      <th className="pb-2 text-left font-medium">平台</th>
                      <th className="pb-2 text-right font-medium">播放量</th>
                      <th className="pb-2 text-right font-medium">完播率</th>
                      <th className="pb-2 text-right font-medium">点赞</th>
                      <th className="pb-2 text-right font-medium">评论</th>
                      <th className="pb-2 text-right font-medium">分享</th>
                      <th className="pb-2 text-right font-medium">观看时长</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(platformMap).map(([platform, snaps]) => {
                      const latest = snaps.slice().sort((a, b) =>
                        new Date(b.snapshot_at).getTime() - new Date(a.snapshot_at).getTime()
                      )[0]
                      return (
                        <tr key={platform} className="border-b border-white/[0.04] last:border-0 text-white/80">
                          <td className="py-2.5 font-medium text-white">{platform}</td>
                          <td className="py-2.5 text-right tabular-nums">{fmt(latest.views)}</td>
                          <td className="py-2.5 text-right tabular-nums">{fmtRate(latest.completion_rate)}</td>
                          <td className="py-2.5 text-right tabular-nums">{fmt(latest.likes)}</td>
                          <td className="py-2.5 text-right tabular-nums">{fmt(latest.comments)}</td>
                          <td className="py-2.5 text-right tabular-nums">{fmt(latest.shares)}</td>
                          <td className="py-2.5 text-right tabular-nums">{fmtWatchTime(latest.watch_time)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </GlassSurface>
          )}

          {/* ── 快照历史 ── */}
          {snapshots.length > 0 && (
            <GlassSurface variant="panel">
              <div className="flex items-center gap-2 mb-4">
                <Layers className="h-4 w-4 text-white/40" />
                <h2 className="text-sm font-semibold text-white">快照历史（最近 {snapshots.length} 条）</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-zinc-500">
                      <th className="pb-2 text-left font-medium">快照时间</th>
                      <th className="pb-2 text-left font-medium">平台</th>
                      <th className="pb-2 text-right font-medium">播放量</th>
                      <th className="pb-2 text-right font-medium">完播率</th>
                      <th className="pb-2 text-right font-medium">点赞</th>
                      <th className="pb-2 text-right font-medium">分享</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots
                      .slice()
                      .sort((a, b) => new Date(b.snapshot_at).getTime() - new Date(a.snapshot_at).getTime())
                      .map((s) => (
                        <tr key={s.id} className="border-b border-white/[0.04] last:border-0 text-white/80 hover:bg-white/[0.02] transition-colors">
                          <td className="py-2 tabular-nums text-zinc-400">
                            {new Date(s.snapshot_at).toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="py-2 text-zinc-300">{s.platform ?? '—'}</td>
                          <td className="py-2 text-right tabular-nums">{fmt(s.views)}</td>
                          <td className="py-2 text-right tabular-nums">{fmtRate(s.completion_rate)}</td>
                          <td className="py-2 text-right tabular-nums">{fmt(s.likes)}</td>
                          <td className="py-2 text-right tabular-nums">{fmt(s.shares)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </GlassSurface>
          )}

          {/* ── 无数据提示 ── */}
          {snapshots.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
              <Zap className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">该集数暂无 analytics 快照</p>
              <p className="text-xs mt-1 text-zinc-700">发布并记录快照后，数据将在此展示</p>
            </div>
          )}
        </>
      )}

      {/* ── 加载态 ── */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-zinc-500">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          加载中...
        </div>
      )}
    </div>
  )
}
