'use client'

import { useEffect, useState } from 'react'
import GlassSurface from '@/components/ui/primitives/GlassSurface'
import GlassButton from '@/components/ui/primitives/GlassButton'
import GlassInput from '@/components/ui/primitives/GlassInput'
import GlassField from '@/components/ui/primitives/GlassField'
import GlassModalShell from '@/components/ui/primitives/GlassModalShell'
import GlassChip from '@/components/ui/primitives/GlassChip'
import { PageHeader } from '@/components/workspace/PageHeader'
import { apiClient, type ApiKey, type ApiKeyCreated } from '@/lib/api-client'

type Tab = 'apikeys' | 'pipeline' | 'gpu'

export default function WorkspaceSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('apikeys')

  return (
    <div className="p-6 md:p-8 space-y-12">
      <PageHeader title="工作区设置" description="管理接口密钥、流水线参数与 GPU 资源配置。" />

        {/* Tab 切换按钮组 */}
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-px">
          <TabButton
            active={activeTab === 'apikeys'}
            onClick={() => setActiveTab('apikeys')}
            label="接口密钥"
            icon="🔑"
          />
          <TabButton
            active={activeTab === 'pipeline'}
            onClick={() => setActiveTab('pipeline')}
            label="流水线"
            icon="⚡"
          />
          <TabButton
            active={activeTab === 'gpu'}
            onClick={() => setActiveTab('gpu')}
            label="GPU 实例"
            icon="🖥️"
          />
        </div>

        {/* Tab 内容 */}
        {activeTab === 'apikeys' && <ApiKeysTab />}
        {activeTab === 'pipeline' && <PipelineTab />}
        {activeTab === 'gpu' && <GpuTab />}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  label,
  icon
}: {
  active: boolean
  onClick: () => void
  label: string
  icon: string
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
        active
          ? 'text-white border-white bg-white/[0.02]'
          : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-white/[0.01]'
      }`}
    >
      <span className="mr-2">{icon}</span>
      {label}
    </button>
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
  const [toggling, setToggling] = useState<string | null>(null)

  const fetchKeys = async () => {
    setLoading(true)
    try {
      const data = await apiClient.listApiKeys()
      setKeys(data)
    } catch (error) {
      console.error('加载 API Keys 失败:', error)
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
      const result = await apiClient.createApiKey({
        name: keyName.trim(),
        provider: keyProvider || undefined,
      })
      setCreatedKey(result)
      setShowCreate(false)
      setKeyName('')
      setKeyProvider('')
      fetchKeys()
    } catch (error) {
      console.error('创建 Key 失败:', error)
    }
  }

  const handleRevoke = async () => {
    if (!revoking) return

    try {
      await apiClient.deleteApiKey(revoking.id)
      setRevoking(null)
      fetchKeys()
    } catch (error) {
      console.error('撤销失败:', error)
    }
  }

  const handleToggleActive = async (key: ApiKey) => {
    setToggling(key.id)
    try {
      await apiClient.updateApiKey(key.id, {
        is_active: !key.is_active
      })
      fetchKeys()
    } catch (error) {
      console.error('切换状态失败:', error)
    } finally {
      setToggling(null)
    }
  }

  const handleCopy = async () => {
    if (!createdKey) return

    try {
      await navigator.clipboard.writeText(createdKey.key)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('复制失败:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* 标题 + 创建按钮 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">接口密钥</h2>
          <p className="text-sm text-zinc-500 mt-1">外部服务凭证管理</p>
        </div>
        <GlassButton
          onClick={() => setShowCreate(true)}
          variant="primary"
        >
          + 创建密钥
        </GlassButton>
      </div>

      {/* Key 列表 */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <GlassSurface key={i} className="h-16 animate-pulse">
              <div className="w-full h-full" />
            </GlassSurface>
          ))}
        </div>
      ) : keys.length === 0 ? (
        <GlassSurface className="flex flex-col items-center justify-center py-24">
          <span className="text-4xl mb-3">🔑</span>
          <span className="text-zinc-400">暂无 API 密钥</span>
          <span className="text-sm text-zinc-600 mt-1">点击上方按钮创建凭证</span>
        </GlassSurface>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => (
            <GlassSurface
              key={key.id}
              className={`flex items-center justify-between px-6 py-4 ${
                !key.is_active ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-center gap-4 min-w-0">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                    key.is_active ? 'bg-indigo-500/10' : 'bg-zinc-800'
                  }`}
                >
                  <span className="text-lg">🔑</span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white truncate">
                    {key.name}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                    <code className="font-mono">{key.key_prefix}...</code>
                    {key.provider && <span>· {key.provider}</span>}
                    <span>· {new Date(key.created_at).toLocaleDateString('zh-CN')}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <GlassChip tone={key.is_active ? 'success' : 'neutral'}>
                  {key.is_active ? '有效' : '已停用'}
                </GlassChip>
                <GlassButton
                  onClick={() => handleToggleActive(key)}
                  disabled={toggling === key.id}
                  size="sm"
                  variant="secondary"
                >
                  {toggling === key.id ? '...' : key.is_active ? '停用' : '启用'}
                </GlassButton>
                {key.is_active && (
                  <GlassButton
                    onClick={() => setRevoking(key)}
                    size="sm"
                    variant="danger"
                  >
                    撤销
                  </GlassButton>
                )}
              </div>
            </GlassSurface>
          ))}
        </div>
      )}

      {/* 创建 Modal */}
      <GlassModalShell
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="创建 API 密钥"
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <GlassButton
              onClick={() => setShowCreate(false)}
              variant="secondary"
            >
              取消
            </GlassButton>
            <GlassButton
              onClick={handleCreate}
              disabled={!keyName.trim()}
              variant="primary"
            >
              创建
            </GlassButton>
          </div>
        }
      >
        <div className="space-y-4">
          <GlassField label="密钥名称" required>
            <GlassInput
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="例如: Kling Production"
            />
          </GlassField>
          <GlassField label="服务商标识">
            <GlassInput
              value={keyProvider}
              onChange={(e) => setKeyProvider(e.target.value)}
              placeholder="例如: kling, elevenlabs（可选）"
            />
          </GlassField>
        </div>
      </GlassModalShell>

      {/* 创建成功 Modal */}
      <GlassModalShell
        open={!!createdKey}
        onClose={() => setCreatedKey(null)}
        title="密钥已创建"
        size="sm"
        footer={
          <GlassButton
            onClick={() => setCreatedKey(null)}
            variant="primary"
          >
            完成
          </GlassButton>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-sm text-amber-400">
            <span>⚠️</span>
            <span>请立即复制，此 Key 仅显示一次</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-zinc-800 border border-zinc-700 p-3">
            <code className="flex-1 overflow-x-auto font-mono text-xs text-white break-all">
              {createdKey?.key}
            </code>
            <GlassButton
              onClick={handleCopy}
              size="sm"
              variant="secondary"
            >
              {copied ? '✓' : '复制'}
            </GlassButton>
          </div>
        </div>
      </GlassModalShell>

      {/* 撤销确认 Modal */}
      <GlassModalShell
        open={!!revoking}
        onClose={() => setRevoking(null)}
        title="撤销 API 密钥"
        description={
          <>
            确定要撤销「<span className="font-medium text-white">{revoking?.name}</span>」吗？
            撤销后使用此 Key 的服务将无法访问 API，且此操作不可恢复。
          </>
        }
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <GlassButton
              onClick={() => setRevoking(null)}
              variant="secondary"
            >
              取消
            </GlassButton>
            <GlassButton
              onClick={handleRevoke}
              variant="danger"
            >
              确认撤销
            </GlassButton>
          </div>
        }
      >
        <div />
      </GlassModalShell>
    </div>
  )
}

function PipelineTab() {
  return (
    <GlassSurface className="flex flex-col items-center justify-center py-24">
      <span className="text-4xl mb-4">⚡</span>
      <h3 className="text-lg font-medium text-white">流水线配置即将上线</h3>
      <p className="mt-2 text-sm text-zinc-500">
        默认模型路由 · 质检阈值配置 · 降级策略设置 · 自动化触发规则
      </p>
    </GlassSurface>
  )
}

function GpuTab() {
  return (
    <GlassSurface className="flex flex-col items-center justify-center py-24">
      <span className="text-4xl mb-4">🖥️</span>
      <h3 className="text-lg font-medium text-white">GPU 实例管理即将上线</h3>
      <p className="mt-2 text-sm text-zinc-500">
        Vast.ai 实例连接 · ComfyUI 健康监控 · 实例自动扩缩容 · 资源用量统计
      </p>
    </GlassSurface>
  )
}
