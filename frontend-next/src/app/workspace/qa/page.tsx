'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'
import type { QARun, QARunDetail, QAIssue } from '@/lib/api-client'
import {
  GlassSurface,
  GlassButton,
  GlassChip,
} from '@/components/ui/primitives'
import { PageHeader } from '@/components/workspace/PageHeader'
import {
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Eye,
  X,
} from 'lucide-react'

const GATE_LABELS: Record<string, string> = {
  G1a: '大纲结构',
  G1b: '合规红线',
  G1c: 'JSON 格式',
  G1d: 'Prompt 安全',
  G2: '人脸完整性',
  G3: '角色一致性',
  G4: '构图安全区',
  G5: '图像质量',
  G6: '动态质量',
  G7: '唇形同步',
  G8: '配音时长',
  G9: '爆音/响度',
  G10: '成片终检',
  G11: '平台规则',
  G12: '人工终审',
}

const QA_STATUS_CONFIG: Record<string, { label: string; color: string; tone: 'neutral' | 'success' | 'danger' | 'warning' }> = {
  passed: { label: '通过', color: '#22C55E', tone: 'success' },
  failed: { label: '失败', color: '#EF4444', tone: 'danger' },
  needs_review: { label: '待审核', color: '#F97316', tone: 'warning' },
  pending: { label: '等待中', color: '#767D88', tone: 'neutral' },
}

const SEVERITY_CONFIG: Record<string, { label: string; color: string; tone: 'neutral' | 'success' | 'danger' | 'warning'; icon: typeof CheckCircle2 }> = {
  critical: { label: '严重', color: '#EF4444', tone: 'danger', icon: XCircle },
  warning: { label: '警告', color: '#F59E0B', tone: 'warning', icon: AlertTriangle },
  info: { label: '信息', color: '#06B6D4', tone: 'neutral', icon: Info },
}

export default function QAPage() {
  const [runs, setRuns] = useState<QARun[]>([])
  const [issues, setIssues] = useState<QAIssue[]>([])
  const [selectedRun, setSelectedRun] = useState<QARunDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'runs' | 'issues'>('runs')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [severityFilter, setSeverityFilter] = useState<string>('all')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [runsData, issuesData] = await Promise.all([
        apiClient.listQARuns({ limit: 100 }),
        apiClient.listQAIssues({ limit: 100 }),
      ])
      setRuns(runsData)
      setIssues(issuesData)
    } catch (error) {
      console.error('Failed to load QA data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSelectRun = async (runId: string) => {
    try {
      const detail = await apiClient.getQARun(runId)
      setSelectedRun(detail)
    } catch (error) {
      console.error('Failed to load QA detail:', error)
    }
  }

  const filteredRuns = statusFilter === 'all'
    ? runs
    : runs.filter((r) => r.status === statusFilter)

  const filteredIssues = severityFilter === 'all'
    ? issues
    : issues.filter((i) => i.severity === severityFilter)

  const passCount = runs.filter((r) => r.status === 'passed').length
  const failCount = runs.filter((r) => r.status === 'failed').length
  const reviewCount = runs.filter((r) => r.status === 'needs_review').length

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 bg-zinc-800/50 rounded animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-zinc-800/50 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-48 bg-zinc-800/50 rounded-lg animate-pulse" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 space-y-6">
      <PageHeader title="质检中心" description="集中查看质检记录、问题清单与门禁结果。" />

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <GlassSurface variant="panel" className="!p-4">
          <div className="text-xs font-semibold text-zinc-400 mb-1 uppercase tracking-wider">总检查次数</div>
          <div className="text-2xl font-bold text-white font-mono">{runs.length}</div>
        </GlassSurface>

        <GlassSurface variant="panel" className="!p-4">
          <div className="text-xs font-semibold text-zinc-400 mb-1 uppercase tracking-wider flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#22C55E' }} />
            通过
          </div>
          <div className="text-2xl font-bold font-mono" style={{ color: '#22C55E' }}>{passCount}</div>
        </GlassSurface>

        <GlassSurface variant="panel" className="!p-4">
          <div className="text-xs font-semibold text-zinc-400 mb-1 uppercase tracking-wider flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#EF4444' }} />
            失败
          </div>
          <div className="text-2xl font-bold font-mono" style={{ color: '#EF4444' }}>{failCount}</div>
        </GlassSurface>

        <GlassSurface variant="panel" className="!p-4">
          <div className="text-xs font-semibold text-zinc-400 mb-1 uppercase tracking-wider flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#F97316' }} />
            待审核
          </div>
          <div className="text-2xl font-bold font-mono" style={{ color: '#F97316' }}>{reviewCount}</div>
        </GlassSurface>
      </div>

      {/* Tabs */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-1">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('runs')}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'runs'
                ? 'bg-zinc-700/50 text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            QA 记录 ({filteredRuns.length})
          </button>
          <button
            onClick={() => setActiveTab('issues')}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'issues'
                ? 'bg-zinc-700/50 text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            问题列表 ({filteredIssues.length})
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'runs' ? (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-zinc-800/50 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-zinc-600"
              >
                <option value="all">全部状态</option>
                <option value="passed">通过</option>
                <option value="failed">失败</option>
                <option value="needs_review">待审核</option>
                <option value="pending">等待中</option>
              </select>
            </div>
            <GlassButton
              variant="ghost"
              size="sm"
              iconLeft={<RefreshCw className="h-3.5 w-3.5" />}
              onClick={fetchData}
              className="!text-zinc-400 hover:!text-white"
            >
              刷新
            </GlassButton>
          </div>

          {/* Empty State */}
          {filteredRuns.length === 0 ? (
            <GlassSurface variant="panel" className="!py-16 text-center">
              <ShieldCheck className="h-12 w-12 mx-auto mb-4 text-zinc-600" />
              <h3 className="text-lg font-semibold text-white mb-1">暂无 QA 记录</h3>
              <p className="text-sm text-zinc-500">开始创作后，质检记录将显示在这里</p>
            </GlassSurface>
          ) : (
            <GlassSurface variant="panel" className="!p-0 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">门禁</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">步骤</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">版本 ID</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">状态</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">分数</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">时间</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRuns.map((run) => {
                    const sc = QA_STATUS_CONFIG[run.status] || QA_STATUS_CONFIG.pending
                    const score = run.score_json?.overall
                    return (
                      <tr
                        key={run.id}
                        className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors last:border-b-0"
                      >
                        <td className="px-4 py-3">
                          <GlassChip tone="neutral" className="text-[10px] font-mono">
                            {GATE_LABELS[run.gate_code] || run.gate_code}
                          </GlassChip>
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-400 font-mono">{run.step_key || '—'}</td>
                        <td className="px-4 py-3 text-[10px] text-zinc-500 font-mono">{run.subject_id.slice(0, 8)}</td>
                        <td className="px-4 py-3">
                          <GlassChip tone={sc.tone}>{sc.label}</GlassChip>
                          {run.status === 'failed' && score !== undefined && (
                            <span className="text-[10px] text-red-400/60 ml-2 font-mono">
                              {score.toFixed(1)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-white font-mono">
                          {score !== undefined ? (
                            <span style={{ color: score >= 70 ? '#22C55E' : '#EF4444' }}>
                              {score.toFixed(1)}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-500">
                          {run.created_at ? new Date(run.created_at).toLocaleString('zh-CN') : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <GlassButton
                            variant="ghost"
                            size="sm"
                            iconLeft={<Eye className="h-3.5 w-3.5" />}
                            onClick={() => handleSelectRun(run.id)}
                            className="!text-zinc-400 hover:!text-white"
                          >
                            查看
                          </GlassButton>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </GlassSurface>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setSeverityFilter('all')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                severityFilter === 'all'
                  ? 'bg-zinc-700/50 text-white'
                  : 'bg-zinc-800/50 text-zinc-400 hover:text-white'
              }`}
            >
              全部 ({issues.length})
            </button>
            <button
              onClick={() => setSeverityFilter('critical')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                severityFilter === 'critical'
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-zinc-800/50 text-zinc-400 hover:text-white'
              }`}
            >
              严重
            </button>
            <button
              onClick={() => setSeverityFilter('warning')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                severityFilter === 'warning'
                  ? 'bg-orange-500/20 text-orange-400'
                  : 'bg-zinc-800/50 text-zinc-400 hover:text-white'
              }`}
            >
              警告
            </button>
            <button
              onClick={() => setSeverityFilter('info')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                severityFilter === 'info'
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'bg-zinc-800/50 text-zinc-400 hover:text-white'
              }`}
            >
              信息
            </button>
          </div>

          {/* Empty State */}
          {filteredIssues.length === 0 ? (
            <GlassSurface variant="panel" className="!py-16 text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-zinc-600" />
              <h3 className="text-lg font-semibold text-white mb-1">暂无 QA 问题</h3>
              <p className="text-sm text-zinc-500">质检通过，没有发现问题</p>
            </GlassSurface>
          ) : (
            <div className="space-y-3">
              {filteredIssues.map((issue) => {
                const sc = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.info
                const Icon = sc.icon
                return (
                  <GlassSurface
                    key={issue.id}
                    variant="panel"
                    interactive
                    className="!p-4 hover:!border-zinc-600 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: sc.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <GlassChip tone="neutral" className="text-[10px] font-mono">
                            {issue.issue_code}
                          </GlassChip>
                          <GlassChip tone={sc.tone}>{sc.label}</GlassChip>
                        </div>
                        <p className="text-sm text-white leading-relaxed">{issue.message}</p>
                        {issue.suggested_action && (
                          <p className="mt-2 text-xs text-zinc-400 bg-zinc-800/50 rounded px-2 py-1.5">
                            <span className="font-medium">建议：</span>{issue.suggested_action}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-zinc-500 shrink-0 whitespace-nowrap">
                        {issue.created_at ? new Date(issue.created_at).toLocaleString('zh-CN') : ''}
                      </span>
                    </div>
                  </GlassSurface>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Detail Panel */}
      {selectedRun && (
        <GlassSurface variant="elevated" className="!p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-white">QA 详情</h3>
              <GlassChip tone="neutral" className="text-[10px] font-mono">
                {selectedRun.id.slice(0, 8)}
              </GlassChip>
              <GlassChip tone={QA_STATUS_CONFIG[selectedRun.status]?.tone || 'neutral'}>
                {QA_STATUS_CONFIG[selectedRun.status]?.label || selectedRun.status}
              </GlassChip>
            </div>
            <GlassButton
              variant="ghost"
              size="sm"
              iconLeft={<X className="h-3.5 w-3.5" />}
              onClick={() => setSelectedRun(null)}
              className="!text-zinc-400 hover:!text-white"
            >
              关闭
            </GlassButton>
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">门禁</div>
              <div className="text-white font-mono">
                {GATE_LABELS[selectedRun.gate_code] || selectedRun.gate_code}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">步骤</div>
              <div className="text-white font-mono">{selectedRun.step_key || '—'}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">检查对象</div>
              <div className="text-white font-mono">
                {selectedRun.subject_type}:{selectedRun.subject_id.slice(0, 8)}
              </div>
            </div>
            {selectedRun.score_json && (
              <div className="space-y-1">
                <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">分数</div>
                <div className="text-white font-mono text-xs">
                  {Object.entries(selectedRun.score_json)
                    .map(([k, v]) => `${k}: ${(v as number).toFixed(1)}`)
                    .join(' / ')}
                </div>
              </div>
            )}
            {selectedRun.threshold_snapshot && (
              <div className="space-y-1">
                <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">阈值</div>
                <div className="text-white font-mono text-xs">
                  {Object.entries(selectedRun.threshold_snapshot)
                    .map(([k, v]) => `${k}: ${(v as number).toFixed(1)}`)
                    .join(' / ')}
                </div>
              </div>
            )}
          </div>

          {/* Issues in this run */}
          {selectedRun.issues && selectedRun.issues.length > 0 && (
            <div className="pt-4 border-t border-zinc-800">
              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                关联问题 ({selectedRun.issues.length})
              </h4>
              <div className="space-y-2">
                {selectedRun.issues.map((issue) => {
                  const sc = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.info
                  return (
                    <div key={issue.id} className="flex items-start gap-2 text-sm bg-zinc-800/30 rounded px-3 py-2">
                      <span className="inline-block h-1.5 w-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: sc.color }} />
                      <span className="text-white">{issue.message}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </GlassSurface>
      )}
    </div>
  )
}
