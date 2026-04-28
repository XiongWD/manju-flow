import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Eye,
  FolderKanban,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import { qaApi, seedApi } from '@/lib/api'
import type { QARun, QAIssue } from '@/types'
import { useNavigate } from 'react-router-dom'

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

const QA_STATUS_CONFIG: Record<string, { label: string; color: string; variant: 'success' | 'destructive' | 'warning' | 'outline' }> = {
  passed: { label: '通过', color: '#22C55E', variant: 'success' },
  failed: { label: '失败', color: '#EF4444', variant: 'destructive' },
  needs_review: { label: '待审核', color: '#F97316', variant: 'warning' },
  pending: { label: '等待中', color: '#767D88', variant: 'outline' },
}

const SEVERITY_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  critical: { label: '严重', color: '#EF4444', icon: XCircle },
  warning: { label: '警告', color: '#F59E0B', icon: AlertTriangle },
  info: { label: '信息', color: '#06B6D4', icon: Info },
}

export default function QACenter() {
  const navigate = useNavigate()
  const { id: projectId } = useParams()
  const [runs, setRuns] = useState<QARun[]>([])
  const [issues, setIssues] = useState<QAIssue[]>([])
  const [selectedRun, setSelectedRun] = useState<QARun | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const [runsData, issuesData] = await Promise.all([
        qaApi.listRuns({ project_id: projectId }),
        qaApi.listIssues({ project_id: projectId }),
      ])
      setRuns(runsData)
      setIssues(issuesData)
    } catch {
      toast.error('加载 QA 数据失败')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSelectRun = async (runId: string) => {
    try {
      const detail = await qaApi.getRun(runId)
      setSelectedRun(detail)
    } catch {
      toast.error('加载 QA 详情失败')
    }
  }

  const handleSeedDemo = async () => {
    try {
      const result = await seedApi.demo()
      navigate(`/projects/${result.project_id}`)
    } catch {}
  }

  const passCount = runs.filter((r) => r.status === 'passed').length
  const failCount = runs.filter((r) => r.status === 'failed').length
  const reviewCount = runs.filter((r) => r.status === 'needs_review').length

  return (
    <div className="space-y-8">
      {/* ── 页面标题 ── */}
      <div className="animate-in">
        <div className="section-kicker mb-3">Quality Assurance</div>
        <div className="flex items-end justify-between">
          <h1 className="display-page text-white">质检中心</h1>
          {!projectId && (
            <Button onClick={handleSeedDemo} className="bg-primary text-white rounded-lg px-6 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors duration-200">
              <FolderKanban className="mr-2 h-4 w-4" />
              生成演示数据
            </Button>
          )}
        </div>
      </div>

      {!projectId ? (
        <Card className="border-white/[0.06] bg-[#141416]">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ShieldCheck className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <h3 className="text-lg font-semibold text-white">请先选择项目</h3>
            <p className="mt-2 text-sm text-[#767D88] max-w-md text-center">
              从项目列表进入，或点击上方按钮生成演示数据。
            </p>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      ) : (
        <>
          {/* ── 概览统计 ── */}
          <div className="grid grid-cols-4 gap-4 animate-in animate-in-delay-1">
            <div className="rounded-lg border border-white/[0.06] bg-[#141416] p-4">
              <div className="meta-ui mb-1">总检查次数</div>
              <div className="text-2xl font-semibold text-white font-display">{runs.length}</div>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-[#141416] p-4">
              <div className="meta-ui mb-1 flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#22C55E' }} />
                通过
              </div>
              <div className="text-2xl font-semibold font-display" style={{ color: '#22C55E' }}>{passCount}</div>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-[#141416] p-4">
              <div className="meta-ui mb-1 flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#EF4444' }} />
                失败
              </div>
              <div className="text-2xl font-semibold font-display" style={{ color: '#EF4444' }}>{failCount}</div>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-[#141416] p-4">
              <div className="meta-ui mb-1 flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#F97316' }} />
                待审核
              </div>
              <div className="text-2xl font-semibold font-display" style={{ color: '#F97316' }}>{reviewCount}</div>
            </div>
          </div>

          <Tabs defaultValue="runs" className="space-y-6">
            <TabsList className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-1 h-auto">
              <TabsTrigger value="runs" className="rounded-md px-4 py-2 text-sm data-[state=active]:bg-white/[0.08] data-[state=active]:text-white text-[#767D88]">
                QA 记录
              </TabsTrigger>
              <TabsTrigger value="issues" className="rounded-md px-4 py-2 text-sm data-[state=active]:bg-white/[0.08] data-[state=active]:text-white text-[#767D88]">
                问题列表
              </TabsTrigger>
            </TabsList>

            {/* ── QA Runs ── */}
            <TabsContent value="runs" className="space-y-4 animate-in">
              <div className="flex items-center justify-between">
                <span className="meta-ui">{runs.length} 条记录</span>
                <Button variant="ghost" size="sm" onClick={fetchData} className="text-[#767D88] hover:text-white text-xs">
                  <RefreshCw className="mr-1.5 h-3 w-3" />
                  刷新
                </Button>
              </div>

              {runs.length === 0 ? (
                <Card className="border-white/[0.06] bg-[#141416]">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <ShieldCheck className="mb-3 h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm text-[#767D88]">暂无 QA 记录</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="rounded-lg border border-white/[0.06] bg-[#141416] overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/[0.06] hover:bg-transparent">
                        <TableHead className="text-[#767D88] text-xs font-medium uppercase tracking-wider">门禁</TableHead>
                        <TableHead className="text-[#767D88] text-xs font-medium uppercase tracking-wider">步骤</TableHead>
                        <TableHead className="text-[#767D88] text-xs font-medium uppercase tracking-wider">版本 ID</TableHead>
                        <TableHead className="text-[#767D88] text-xs font-medium uppercase tracking-wider">状态</TableHead>
                        <TableHead className="text-[#767D88] text-xs font-medium uppercase tracking-wider">分数</TableHead>
                        <TableHead className="text-[#767D88] text-xs font-medium uppercase tracking-wider">时间</TableHead>
                        <TableHead className="text-[#767D88] text-xs font-medium uppercase tracking-wider text-right">详情</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {runs.map((run) => {
                        const sc = QA_STATUS_CONFIG[run.status] || QA_STATUS_CONFIG.pending
                        const score = run.score_json?.overall
                        return (
                          <TableRow key={run.id} className="border-white/[0.04] hover:bg-white/[0.02]">
                            <TableCell>
                              <Badge variant="outline" className="font-mono text-[10px]">
                                {GATE_LABELS[run.gate_code] || run.gate_code}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-[#767D88] font-mono">{run.step_key || '—'}</TableCell>
                            <TableCell className="text-[10px] text-[#767D88] font-mono">
                              {run.subject_id.slice(0, 8)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={sc.variant} className="text-[10px]">{sc.label}</Badge>
                              {run.status === 'failed' && (
                                <span className="text-[10px] text-red-400/60 ml-1">
                                  score: {score !== undefined ? score.toFixed(1) : '—'}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-white">
                              {score !== undefined ? (
                                <span style={{ color: score >= 70 ? '#22C55E' : '#EF4444' }}>
                                  {score.toFixed(1)}
                                </span>
                              ) : '—'}
                            </TableCell>
                            <TableCell className="text-xs text-[#767D88]">
                              {run.created_at ? new Date(run.created_at).toLocaleString('zh-CN') : '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSelectRun(run.id)}
                                className="text-primary text-xs hover:text-primary/80"
                              >
                                <Eye className="mr-1 h-3 w-3" />
                                查看
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* ── QA Issues ── */}
            <TabsContent value="issues" className="space-y-4 animate-in">
              {issues.length === 0 ? (
                <Card className="border-white/[0.06] bg-[#141416]">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <CheckCircle2 className="mb-3 h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm text-[#767D88]">暂无 QA 问题</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {issues.map((issue) => {
                    const sc = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.info
                    const Icon = sc.icon
                    return (
                      <div
                        key={issue.id}
                        className="rounded-lg border border-white/[0.06] bg-[#141416] p-4 hover:border-white/[0.1] transition-colors duration-200"
                      >
                        <div className="flex items-start gap-3">
                          <Icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: sc.color }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="font-mono text-[10px]">{issue.issue_code}</Badge>
                              <Badge variant="outline" className="text-[10px]" style={{ borderColor: sc.color, color: sc.color }}>
                                {sc.label}
                              </Badge>
                            </div>
                            <p className="text-sm text-white">{issue.message}</p>
                            {issue.suggested_action && (
                              <p className="mt-1 text-xs text-[#767D88]">
                                建议：{issue.suggested_action}
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-[#767D88] shrink-0">
                            {issue.created_at ? new Date(issue.created_at).toLocaleString('zh-CN') : ''}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* ── QA Run 详情面板 ── */}
          {selectedRun && (
            <div className="rounded-lg border border-white/[0.06] bg-[#141416] p-5 animate-in">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-medium text-white">QA 详情</h3>
                  <Badge variant="outline" className="font-mono text-[10px]">{selectedRun.id.slice(0, 8)}</Badge>
                  <Badge variant={QA_STATUS_CONFIG[selectedRun.status]?.variant || 'outline'} className="text-[10px]">
                    {QA_STATUS_CONFIG[selectedRun.status]?.label || selectedRun.status}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedRun(null)}
                  className="text-[#767D88] hover:text-white text-xs"
                >
                  关闭
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-[#767D88]">门禁</span>
                  <p className="text-white font-mono">{GATE_LABELS[selectedRun.gate_code] || selectedRun.gate_code}</p>
                </div>
                <div>
                  <span className="text-[#767D88]">步骤</span>
                  <p className="text-white font-mono">{selectedRun.step_key || '—'}</p>
                </div>
                <div>
                  <span className="text-[#767D88]">检查对象</span>
                  <p className="text-white font-mono">{selectedRun.subject_type}:{selectedRun.subject_id.slice(0, 8)}</p>
                </div>
                {selectedRun.score_json && (
                  <div>
                    <span className="text-[#767D88]">分数</span>
                    <p className="text-white font-mono">
                      {Object.entries(selectedRun.score_json).map(([k, v]) => `${k}: ${(v as number).toFixed(1)}`).join(' / ')}
                    </p>
                  </div>
                )}
                {selectedRun.threshold_snapshot && (
                  <div>
                    <span className="text-[#767D88]">阈值</span>
                    <p className="text-white font-mono">
                      {Object.entries(selectedRun.threshold_snapshot).map(([k, v]) => `${k}: ${(v as number).toFixed(1)}`).join(' / ')}
                    </p>
                  </div>
                )}
              </div>

              {/* Issues in this run */}
              {selectedRun.issues && selectedRun.issues.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/[0.06]">
                  <h4 className="text-xs font-medium text-[#767D88] uppercase tracking-wider mb-2">
                    关联问题 ({selectedRun.issues.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedRun.issues.map((issue) => {
                      const sc = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.info
                      return (
                        <div key={issue.id} className="flex items-center gap-2 text-sm">
                          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: sc.color }} />
                          <span className="text-white">{issue.message}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
