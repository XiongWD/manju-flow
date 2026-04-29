'use client'

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
  Tv,
  Film,
  Layers,
  Zap,
} from 'lucide-react'
import { GlassSurface } from '@/components/ui/primitives'
import { PageHeader } from '@/components/workspace/PageHeader'

/* ─── Mock data ─── */

interface MetricCard {
  label: string
  value: string
  change: number // positive = up
  icon: React.ElementType
}

const metrics: MetricCard[] = [
  { label: '总播放量', value: '1,284,530', change: 12.4, icon: Eye },
  { label: '完播率', value: '68.7%', change: 3.2, icon: TrendingUp },
  { label: '点赞数', value: '89,210', change: -1.8, icon: Heart },
  { label: '评论数', value: '12,045', change: 8.6, icon: MessageCircle },
  { label: '分享数', value: '34,720', change: 15.1, icon: Share2 },
  { label: '平均观看时长', value: '6m 42s', change: 5.0, icon: Clock },
]

interface PlatformRow {
  platform: string
  icon: React.ElementType
  views: string
  completionRate: string
  likes: string
  shares: string
  watchTime: string
  trend: 'up' | 'down' | 'flat'
}

const platforms: PlatformRow[] = [
  { platform: 'YouTube', icon: Tv, views: '682,100', completionRate: '72.1%', likes: '52,300', shares: '18,400', watchTime: '4,210h', trend: 'up' },
  { platform: '抖音', icon: Tv, views: '390,200', completionRate: '61.3%', likes: '24,500', shares: '11,200', watchTime: '1,830h', trend: 'up' },
  { platform: 'B站', icon: Film, views: '152,800', completionRate: '74.5%', likes: '8,940', shares: '3,600', watchTime: '980h', trend: 'down' },
  { platform: '小红书', icon: Layers, views: '59,430', completionRate: '58.2%', likes: '3,470', shares: '1,520', watchTime: '260h', trend: 'flat' },
]

interface EpisodeRow {
  id: string
  title: string
  snapshotAt: string
  views: string
  completionRate: string
  likes: string
  comments: string
  shares: string
  watchTime: string
}

const episodes: EpisodeRow[] = [
  { id: 'ep-001', title: '第1话 · 黎明之前', snapshotAt: '2026-04-28', views: '342,100', completionRate: '74.2%', likes: '22,100', comments: '3,420', shares: '8,900', watchTime: '1,120h' },
  { id: 'ep-002', title: '第2话 · 旧友重逢', snapshotAt: '2026-04-25', views: '298,400', completionRate: '71.8%', likes: '19,800', comments: '2,980', shares: '7,600', watchTime: '980h' },
  { id: 'ep-003', title: '第3话 · 暗流涌动', snapshotAt: '2026-04-22', views: '264,700', completionRate: '69.5%', likes: '17,200', comments: '2,540', shares: '6,800', watchTime: '840h' },
  { id: 'ep-004', title: '第4话 · 命运交汇', snapshotAt: '2026-04-19', views: '198,300', completionRate: '66.1%', likes: '14,500', comments: '1,890', shares: '5,200', watchTime: '620h' },
  { id: 'ep-005', title: '第5话 · 破晓', snapshotAt: '2026-04-16', views: '181,030', completionRate: '63.4%', likes: '15,610', comments: '1,215', shares: '6,220', watchTime: '510h' },
]

interface Insight {
  type: 'positive' | 'warning' | 'info'
  title: string
  description: string
}

const insights: Insight[] = [
  { type: 'positive', title: '完播率持续上升', description: '近 7 天完播率环比增长 3.2%，第1话表现最佳（74.2%）。建议在后续集数中延续开篇悬念策略。' },
  { type: 'warning', title: 'B站互动数据下滑', description: 'B站近两周点赞量下降 12%，分享量下降 8%。可能与发布时间调整有关，建议恢复原发布时段。' },
  { type: 'info', title: '分享转化率创新高', description: '第5话分享率达 3.4%，高于系列平均水平（2.7%）。高光片段策略有效，可考虑在更多平台推广。' },
  { type: 'warning', title: '小红书完播率偏低', description: '小红书平台完播率仅 58.2%，远低于其他平台。建议缩短竖版剪辑时长至 3 分钟以内。' },
]

const trendData = [
  { label: '4/16', views: 125000, likes: 9800 },
  { label: '4/19', views: 198000, likes: 14500 },
  { label: '4/22', views: 264000, likes: 17200 },
  { label: '4/25', views: 298000, likes: 19800 },
  { label: '4/28', views: 342000, likes: 22100 },
]

/* ─── Components ─── */

function ChangeIndicator({ value }: { value: number }) {
  if (value > 0) return <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-400"><ArrowUpRight className="h-3 w-3" />{value}%</span>
  if (value < 0) return <span className="inline-flex items-center gap-0.5 text-xs font-medium text-rose-400"><ArrowDownRight className="h-3 w-3" />{Math.abs(value)}%</span>
  return <span className="inline-flex items-center gap-0.5 text-xs font-medium text-zinc-400"><Minus className="h-3 w-3" />0%</span>
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'up') return <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
  if (trend === 'down') return <ArrowDownRight className="h-3.5 w-3.5 text-rose-400" />
  return <Minus className="h-3.5 w-3.5 text-zinc-500" />
}

function InsightBadge({ type }: { type: Insight['type'] }) {
  const styles = {
    positive: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  }
  const labels = { positive: '正面', warning: '警告', info: '洞察' }
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${styles[type]}`}>{labels[type]}</span>
}

/* ─── Page ─── */

export default function AnalyticsPage() {
  const maxViews = Math.max(...trendData.map(d => d.views))

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 space-y-6">
      <PageHeader
        title="数据分析"
        description="项目播放表现、平台对比与内容洞察（Mock 数据）。"
        actions={<div className="text-xs text-zinc-600">数据快照：2026-04-28 00:00 UTC</div>}
      />

      {/* ── 指标卡 ── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {metrics.map((m) => {
          const Icon = m.icon
          return (
            <GlassSurface key={m.label} variant="card" padded={false} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.04]">
                  <Icon className="h-4 w-4 text-white/50" />
                </div>
                <ChangeIndicator value={m.change} />
              </div>
              <div className="text-xl font-semibold text-white">{m.value}</div>
              <div className="text-[11px] text-zinc-500 mt-1">{m.label}</div>
            </GlassSurface>
          )
        })}
      </div>

      {/* ── 平台表现 ── */}
      <GlassSurface variant="panel">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-4 w-4 text-white/40" />
          <h2 className="text-sm font-semibold text-white">平台表现对比</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-zinc-500">
                <th className="pb-2 text-left font-medium">平台</th>
                <th className="pb-2 text-right font-medium">播放量</th>
                <th className="pb-2 text-right font-medium">完播率</th>
                <th className="pb-2 text-right font-medium">点赞</th>
                <th className="pb-2 text-right font-medium">分享</th>
                <th className="pb-2 text-right font-medium">观看时长</th>
                <th className="pb-2 text-right font-medium">趋势</th>
              </tr>
            </thead>
            <tbody>
              {platforms.map((p) => {
                const Icon = p.icon
                return (
                  <tr key={p.platform} className="border-b border-white/[0.04] last:border-0 text-white/80">
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-white/40" />
                        <span className="font-medium text-white">{p.platform}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{p.views}</td>
                    <td className="py-2.5 text-right tabular-nums">{p.completionRate}</td>
                    <td className="py-2.5 text-right tabular-nums">{p.likes}</td>
                    <td className="py-2.5 text-right tabular-nums">{p.shares}</td>
                    <td className="py-2.5 text-right tabular-nums">{p.watchTime}</td>
                    <td className="py-2.5 text-right"><TrendIcon trend={p.trend} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </GlassSurface>

      {/* ── 播放趋势 (简化柱状图) ── */}
      <GlassSurface variant="panel">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-white/40" />
          <h2 className="text-sm font-semibold text-white">播放趋势</h2>
        </div>
        <div className="flex items-end gap-3 h-40">
          {trendData.map((d) => (
            <div key={d.label} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full relative rounded-t-md bg-white/[0.06] overflow-hidden" style={{ height: '120px' }}>
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-t-md bg-primary/60 transition-all"
                  style={{ height: `${(d.views / maxViews) * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-zinc-500 tabular-nums">{d.label}</span>
              <span className="text-[11px] text-white/60 tabular-nums font-medium">{(d.views / 1000).toFixed(0)}K</span>
            </div>
          ))}
        </div>
      </GlassSurface>

      {/* ── Episode 列表 ── */}
      <GlassSurface variant="panel">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="h-4 w-4 text-white/40" />
          <h2 className="text-sm font-semibold text-white">集数详情</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-zinc-500">
                <th className="pb-2 text-left font-medium">集数</th>
                <th className="pb-2 text-right font-medium">快照日期</th>
                <th className="pb-2 text-right font-medium">播放量</th>
                <th className="pb-2 text-right font-medium">完播率</th>
                <th className="pb-2 text-right font-medium">点赞</th>
                <th className="pb-2 text-right font-medium">评论</th>
                <th className="pb-2 text-right font-medium">分享</th>
                <th className="pb-2 text-right font-medium">观看时长</th>
              </tr>
            </thead>
            <tbody>
              {episodes.map((ep) => (
                <tr key={ep.id} className="border-b border-white/[0.04] last:border-0 text-white/80 hover:bg-white/[0.02] transition-colors">
                  <td className="py-2.5 font-medium text-white">{ep.title}</td>
                  <td className="py-2.5 text-right tabular-nums text-zinc-500">{ep.snapshotAt}</td>
                  <td className="py-2.5 text-right tabular-nums">{ep.views}</td>
                  <td className="py-2.5 text-right tabular-nums">{ep.completionRate}</td>
                  <td className="py-2.5 text-right tabular-nums">{ep.likes}</td>
                  <td className="py-2.5 text-right tabular-nums">{ep.comments}</td>
                  <td className="py-2.5 text-right tabular-nums">{ep.shares}</td>
                  <td className="py-2.5 text-right tabular-nums">{ep.watchTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassSurface>

      {/* ── Insights ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-white/40" />
          <h2 className="text-sm font-semibold text-white">智能洞察</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {insights.map((insight, i) => (
            <GlassSurface key={i} variant="card" padded={false} className="p-4">
              <div className="flex items-start gap-3">
                {insight.type === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <InsightBadge type={insight.type} />
                    <span className="text-sm font-medium text-white">{insight.title}</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">{insight.description}</p>
                </div>
              </div>
            </GlassSurface>
          ))}
        </div>
      </div>
    </div>
  )
}
