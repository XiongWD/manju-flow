import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Plus, Copy, Check, Key, AlertTriangle, GitBranch, Cpu, Sliders } from 'lucide-react'
import { toast } from 'sonner'
import { apikeyApi, type ApiKey, type ApiKeyCreated } from '@/lib/api'

/** Tab with 2px underline on active */
function Tab({ value, label, icon: Icon }: { value: string; label: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <TabsTrigger
      value={value}
      className="tab-active-underline relative rounded-none border-none px-4 py-2.5 text-sm text-[#767D88] transition-colors duration-200 hover:text-white/70 data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none flex items-center gap-2"
    >
      <Icon className="h-4 w-4" />
      {label}
    </TabsTrigger>
  )
}

export default function Settings() {
  return (
    <div className="space-y-12">
      {/* ── 页面标题区 — 系统控制台气质 ── */}
      <div className="animate-in">
        <div className="section-kicker mb-3">System</div>
        <h1 className="display-page text-white">
          设置
        </h1>
        <p className="mt-2 body-ui text-[#7D8490] max-w-md">
          API 凭证、流水线参数和 GPU 资源管理。
        </p>
      </div>

      {/* ── 控制面板 Tabs ── */}
      <div className="animate-in animate-in-delay-1">
        <Tabs defaultValue="apikeys">
          <div className="border-b border-white/[0.06]">
            <TabsList className="h-auto gap-0 rounded-none bg-transparent p-0">
              <Tab value="general" label="通用" icon={Sliders} />
              <Tab value="apikeys" label="API Keys" icon={Key} />
              <Tab value="pipeline" label="流水线" icon={GitBranch} />
              <Tab value="gpu" label="GPU 实例" icon={Cpu} />
            </TabsList>
          </div>

          <TabsContent value="general" className="mt-0 pt-8">
            <GeneralTab />
          </TabsContent>
          <TabsContent value="apikeys" className="mt-0 pt-8">
            <ApiKeysTab />
          </TabsContent>
          <TabsContent value="pipeline" className="mt-0 pt-8">
            <PipelineTab />
          </TabsContent>
          <TabsContent value="gpu" className="mt-0 pt-8">
            <GpuTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

/** 占位模块 — 系统控制台风格的未开放面板 */
function PlaceholderPanel({
  icon: Icon,
  title,
  description,
  phase = 'Phase 1',
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  phase?: string
}) {
  return (
    <div className="surface-2 px-8 py-10 flex flex-col items-center justify-center text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.04] mb-3">
        <Icon className="h-[18px] w-[18px] text-[#7D8490]" />
      </div>
      <h3 className="text-sm font-medium text-white">{title}</h3>
      <p className="mt-1.5 meta-ui max-w-sm">{description}</p>
      <span className="mt-3 font-mono text-[10px] uppercase tracking-wider text-white/15">
        {phase}
      </span>
    </div>
  )
}

function GeneralTab() {
  return (
    <PlaceholderPanel
      icon={Sliders}
      title="通用设置即将上线"
      description="默认项目偏好 · 通知设置 · 主题偏好 · 团队配置"
    />
  )
}

function PipelineTab() {
  return (
    <PlaceholderPanel
      icon={GitBranch}
      title="流水线配置"
      description="默认模型路由 · 质检阈值配置 · 降级策略设置 · 自动化触发规则"
    />
  )
}

function GpuTab() {
  return (
    <PlaceholderPanel
      icon={Cpu}
      title="GPU 实例管理"
      description="Vast.ai 实例连接 · ComfyUI 健康监控 · 实例自动扩缩容 · 资源用量统计"
    />
  )
}

function ApiKeysTab() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [keyName, setKeyName] = useState('')
  const [keyProvider, setKeyProvider] = useState('')
  const [createdKey, setCreatedKey] = useState<ApiKeyCreated | null>(null)
  const [revoking, setRevoking] = useState<ApiKey | null>(null)
  const [copied, setCopied] = useState(false)

  const fetchKeys = async () => {
    setLoading(true)
    try {
      const data = await apikeyApi.list()
      setKeys(data)
    } catch {
      toast.error('加载 API Keys 失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchKeys()
  }, [])

  const handleCreate = async () => {
    if (!keyName.trim()) return
    try {
      const result = await apikeyApi.create({
        name: keyName.trim(),
        provider: keyProvider || undefined,
      })
      setCreatedKey(result)
      setShowCreate(false)
      setKeyName('')
      setKeyProvider('')
      fetchKeys()
    } catch {
      toast.error('创建 Key 失败')
    }
  }

  const handleRevoke = async () => {
    if (!revoking) return
    try {
      await apikeyApi.delete(revoking.id)
      toast.success('API Key 已撤销')
      setRevoking(null)
      fetchKeys()
    } catch {
      toast.error('撤销失败')
    }
  }

  const handleCopy = async () => {
    if (!createdKey) return
    try {
      await navigator.clipboard.writeText(createdKey.key)
      setCopied(true)
      toast.success('已复制到剪贴板')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('复制失败')
    }
  }

  return (
    <div className="space-y-8">
      {/* 标题 + 创建按钮 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-white tracking-[-0.01em]">
            API Keys
          </h2>
          <p className="meta-ui mt-1">外部服务凭证管理</p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-primary text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-primary/90 transition-colors duration-200"
        >
          <Plus className="mr-2 h-4 w-4" />
          创建密钥
        </Button>
      </div>

      {/* Key 列表 — 凭证资产风格 */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : keys.length === 0 ? (
        <div className="surface-2 flex flex-col items-center justify-center py-24">
          <Key className="h-8 w-8 text-white/[0.06] mb-3" />
          <span className="body-ui text-[#7D8490]">暂无 API 密钥</span>
          <span className="meta-ui mt-1">点击上方按钮创建凭证</span>
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => (
            <div
              key={key.id}
              className={`surface-2 hover-surface flex items-center justify-between px-6 py-4 ${
                !key.is_active ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-center gap-4 min-w-0">
                {/* 左侧 key icon */}
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${key.is_active ? 'bg-primary/10' : 'bg-white/[0.03]'}`}>
                  <Key className={`h-4 w-4 ${key.is_active ? 'text-primary' : 'text-[#767D88]'}`} />
                </div>
                <div className="min-w-0">
                  <div className="text-[14px] font-medium text-white truncate">{key.name}</div>
                  <div className="mt-0.5 flex items-center gap-2 meta-ui">
                    <code className="font-mono text-[11px]">{key.key_prefix}...</code>
                    {key.provider && <span>· {key.provider}</span>}
                    <span>· {new Date(key.created_at).toLocaleDateString('zh-CN')}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Badge
                  variant={key.is_active ? 'success' : 'secondary'}
                  className="text-xs"
                >
                  {key.is_active ? '有效' : '已撤销'}
                </Badge>
                {key.is_active && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs text-red-400 border-white/[0.06] hover:border-red-400/40 hover:text-red-300 rounded-lg"
                    onClick={() => setRevoking(key)}
                  >
                    撤销
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 创建 Modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-[400px] bg-[#141416] border-white/[0.06] rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-white font-display">创建 API 密钥</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="key-name" className="text-[#767D88] text-sm">
                密钥名称 <span className="text-red-400">*</span>
              </Label>
              <Input
                id="key-name"
                placeholder="例如: Kling Production"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                className="bg-white/[0.03] border-white/[0.06] text-white text-sm placeholder:text-[#767D88] focus:border-primary/50 rounded-lg h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="key-provider" className="text-[#767D88] text-sm">服务商标识</Label>
              <Input
                id="key-provider"
                placeholder="例如: kling, elevenlabs（可选）"
                value={keyProvider}
                onChange={(e) => setKeyProvider(e.target.value)}
                className="bg-white/[0.03] border-white/[0.06] text-white text-sm placeholder:text-[#767D88] focus:border-primary/50 rounded-lg h-9"
              />
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setShowCreate(false)} className="border-white/[0.1] text-white/60 rounded-lg px-5 py-2 text-sm hover:bg-white/[0.04] hover:text-white/80">
              取消
            </Button>
            <Button onClick={handleCreate} disabled={!keyName.trim()} className="bg-primary text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-primary/90 transition-colors duration-200">
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 创建成功 Modal */}
      <Dialog open={!!createdKey} onOpenChange={() => setCreatedKey(null)}>
        <DialogContent className="sm:max-w-[500px] bg-[#141416] border-white/[0.06] rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-white font-display">密钥已创建</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-sm text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>请立即复制，此 Key 仅显示一次</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
              <code className="flex-1 overflow-x-auto font-mono text-xs text-white break-all">
                {createdKey?.key}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopy} className="border-white/[0.1] text-white/60 shrink-0 rounded-lg">
                {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedKey(null)} className="bg-primary text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-primary/90 transition-colors duration-200">
              完成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 撤销确认 Modal */}
      <Dialog open={!!revoking} onOpenChange={() => setRevoking(null)}>
        <DialogContent className="sm:max-w-[420px] bg-[#141416] border-white/[0.06] rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-white font-display">撤销 API 密钥</DialogTitle>
            <DialogDescription className="text-[#767D88]">
              确定要撤销「{revoking?.name}」吗？撤销后使用此 Key 的服务将无法访问 API，且此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setRevoking(null)} className="border-white/[0.1] text-white/60 rounded-lg px-5 py-2 text-sm hover:bg-white/[0.04] hover:text-white/80">
              取消
            </Button>
            <Button variant="destructive" onClick={handleRevoke} className="rounded-lg px-5 py-2 text-sm">
              确认撤销
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
