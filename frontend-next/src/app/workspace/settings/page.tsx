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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 space-y-6">
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

const API_KEY_CATEGORIES = [
  {
    id: 'llm',
    label: 'LLM / 剧本生成',
    icon: '🧠',
    description: '大语言模型，用于故事大纲、剧本、分镜描述等文本生成。',
    providers: ['OpenAI (GPT-4o)', 'Anthropic (Claude)', 'DeepSeek', 'Google (Gemini)'],
    usage: '故事大纲生成、剧本扩写、分镜描述、角色对话生成',
    recommendation: '推荐 OpenAI GPT-4o 或 DeepSeek，支持长上下文、中文生成质量好。',
  },
  {
    id: 'image',
    label: '图像生成',
    icon: '🖼️',
    description: '图像生成模型，用于角色设定、分镜画面、背景图等。',
    providers: ['Kling (可灵)', 'Midjourney', 'DALL-E 3', 'Stable Diffusion', 'Flux'],
    usage: '角色设定图、分镜画面生成、背景/场景图、海报素材',
    recommendation: '推荐 Kling（可灵）用于漫剧风格一致性，或 Midjourney 用于高质量概念图。',
  },
  {
    id: 'video',
    label: '视频生成',
    icon: '🎬',
    description: '视频生成模型，用于将分镜图像转为动态视频片段。',
    providers: ['Kling (可灵)', 'Runway Gen-3', 'Pika', 'Sora', 'Luma Dream Machine'],
    usage: '分镜动态化、角色动作视频、场景转场视频',
    recommendation: '推荐 Kling 用于漫剧，支持图像到视频、口型驱动，风格保持较好。',
  },
  {
    id: 'audio',
    label: '音频 / TTS / 配音',
    icon: '🎙️',
    description: '文本转语音、配音、音效生成等服务。',
    providers: ['ElevenLabs', 'Azure TTS', 'Fish Audio', 'CosyVoice', 'ChatTTS'],
    usage: '角色配音（多音色）、旁白、音效生成、语音克隆',
    recommendation: '推荐 ElevenLabs（多语言 + 情感控制）或 Fish Audio（中文 + 语音克隆）。',
  },
  {
    id: 'storage',
    label: '存储 / CDN',
    icon: '☁️',
    description: '对象存储和 CDN 分发，用于存放生成的资产和成片。',
    providers: ['AWS S3', '阿里云 OSS', '腾讯云 COS', 'Cloudflare R2'],
    usage: '图片/视频/音频资产存储、成片 CDN 分发、临时文件缓存',
    recommendation: '推荐 Cloudflare R2（免出口流量费）或阿里云 OSS（国内访问快）。',
  },
  {
    id: 'review',
    label: '审核 / VLM',
    icon: '🛡️',
    description: '视觉语言模型或内容审核 API，用于自动质检和合规检查。',
    providers: ['OpenAI GPT-4V', 'Google Gemini Pro Vision', '阿里云内容安全', 'Azure Content Safety'],
    usage: '画面内容一致性检查、角色连续性检测、合规风险识别、质量评分',
    recommendation: '推荐 GPT-4V 或 Gemini Pro Vision 作为 VLM 质检，搭配平台本地化审核 API。',
  },
] as const

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
  const [showGuide, setShowGuide] = useState(true)

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
          <p className="text-sm text-zinc-500 mt-1">按媒体类型管理外部服务凭证。漫剧生产需要 LLM、图像、视频、音频、存储、审核等多类 API Key。</p>
        </div>
        <div className="flex items-center gap-2">
          <GlassButton
            onClick={() => setShowGuide(!showGuide)}
            variant="secondary"
            size="sm"
          >
            {showGuide ? '收起引导' : '配置引导'}
          </GlassButton>
          <GlassButton
            onClick={() => setShowCreate(true)}
            variant="primary"
          >
            + 创建密钥
          </GlassButton>
        </div>
      </div>

      {/* 分类引导 */}
      {showGuide && (
        <GlassSurface variant="panel" className="!p-5">
          <h3 className="text-sm font-semibold text-white mb-4">🔑 漫剧生产所需 API 密钥分类</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {API_KEY_CATEGORIES.map((cat) => {
              const catKeys = keys.filter((k) => {
                const p = (k.provider || '').toLowerCase()
                const n = (k.name || '').toLowerCase()
                return cat.providers.some((prov) => p.includes(prov.toLowerCase()) || n.includes(prov.toLowerCase()))
              })
              return (
                <div key={cat.id} className="bg-zinc-800/40 rounded-lg p-3.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{cat.icon}</span>
                    <span className="text-sm font-semibold text-white">{cat.label}</span>
                    {catKeys.length > 0 && (
                      <GlassChip tone="success" className="text-[10px]">{catKeys.length} 已配置</GlassChip>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">{cat.description}</p>
                  <div className="text-xs text-zinc-500">
                    <span className="text-zinc-300 font-medium">用途：</span>{cat.usage}
                  </div>
                  <div className="text-xs text-zinc-500">
                    <span className="text-zinc-300 font-medium">推荐：</span>{cat.recommendation}
                  </div>
                  <div className="text-xs text-zinc-600">
                    <span className="font-medium">支持：</span>{cat.providers.join('、')}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-zinc-600 mt-4 leading-relaxed">
            💡 <strong className="text-zinc-500">最小可用配置：</strong>LLM（故事/剧本生成）+ 图像生成（分镜画面）+ 音频/TTS（配音）即可跑通基础流程。
            视频生成、存储、审核可在需要时按需配置。创建密钥时在「服务商标识」填写对应的 provider 名称（如 kling、openai、elevenlabs），系统会自动归类。
          </p>
        </GlassSurface>
      )}

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
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">流水线配置</h2>
        <p className="text-sm text-zinc-500 mt-1">控制漫剧生产流水线的模型路由、质检阈值和自动化行为。当前为配置说明入口，实际执行依赖后端流水线服务。</p>
      </div>

      <GlassSurface variant="panel" className="!p-5 space-y-5">
        <h3 className="text-sm font-semibold text-white">📋 漫剧生产流水线阶段</h3>
        <div className="space-y-3 text-xs">
          <div className="flex gap-3 items-start bg-zinc-800/40 rounded-lg p-3">
            <span className="text-lg shrink-0">📖</span>
            <div>
              <div className="font-semibold text-zinc-300">故事 & 剧本生成</div>
              <p className="text-zinc-500 mt-1">LLM 根据用户输入（题材、风格、集数）生成故事大纲 → 剧本 → 分镜描述。质检门禁 G1a-G1d。</p>
              <p className="text-zinc-600 mt-1"><strong className="text-zinc-500">可配置项：</strong>默认 LLM 模型、最大重试次数、大纲结构校验阈值。</p>
            </div>
          </div>
          <div className="flex gap-3 items-start bg-zinc-800/40 rounded-lg p-3">
            <span className="text-lg shrink-0">🎨</span>
            <div>
              <div className="font-semibold text-zinc-300">角色 & 资产生成</div>
              <p className="text-zinc-500 mt-1">根据剧本生成角色设定图、场景背景、道具等静态资产。质检门禁 G2-G5。</p>
              <p className="text-zinc-600 mt-1"><strong className="text-zinc-500">可配置项：</strong>图像生成模型、角色一致性参考图、生成分辨率、安全区比例。</p>
            </div>
          </div>
          <div className="flex gap-3 items-start bg-zinc-800/40 rounded-lg p-3">
            <span className="text-lg shrink-0">🎬</span>
            <div>
              <div className="font-semibold text-zinc-300">视频渲染</div>
              <p className="text-zinc-500 mt-1">将分镜图像转为动态视频，叠加音频和字幕。质检门禁 G6-G9。</p>
              <p className="text-zinc-600 mt-1"><strong className="text-zinc-500">可配置项：</strong>视频生成模型、帧率、时长限制、唇形同步精度阈值、音频响度标准。</p>
            </div>
          </div>
          <div className="flex gap-3 items-start bg-zinc-800/40 rounded-lg p-3">
            <span className="text-lg shrink-0">✅</span>
            <div>
              <div className="font-semibold text-zinc-300">质检 & 终检</div>
              <p className="text-zinc-500 mt-1">成片级质检，综合所有维度评分。质检门禁 G10-G12。</p>
              <p className="text-zinc-600 mt-1"><strong className="text-zinc-500">可配置项：</strong>终检通过阈值（默认 70 分）、人工终审是否必须、合规红线关键词列表。</p>
            </div>
          </div>
          <div className="flex gap-3 items-start bg-zinc-800/40 rounded-lg p-3">
            <span className="text-lg shrink-0">📦</span>
            <div>
              <div className="font-semibold text-zinc-300">交付 & 发布</div>
              <p className="text-zinc-500 mt-1">生成剪辑包/审片包/发布包，提交到目标平台。</p>
              <p className="text-zinc-600 mt-1"><strong className="text-zinc-500">可配置项：</strong>默认包类型、目标平台列表、自动发布开关。</p>
            </div>
          </div>
        </div>
      </GlassSurface>

      <GlassSurface variant="panel" className="!p-5">
        <h3 className="text-sm font-semibold text-white mb-3">⚙️ 配置示例</h3>
        <div className="bg-zinc-800/60 rounded-lg p-4 font-mono text-xs text-zinc-300 space-y-1">
          <div>{'// 流水线配置（JSON 格式，后端管理）'}</div>
          <div>{'{'}</div>
          <div>{'  "default_llm": "openai/gpt-4o",'}</div>
          <div>{'  "default_image_model": "kling/kling-v2",'}</div>
          <div>{'  "default_video_model": "kling/kling-v2-video",'}</div>
          <div>{'  "default_tts": "elevenlabs/turbo-v2",'}</div>
          <div>{'  "qa_pass_threshold": 70,'}</div>
          <div>{'  "require_human_review": true,'}</div>
          <div>{'  "max_retries": 3,'}</div>
          <div>{'  "audio_lufs_target": -14,'}</div>
          <div>{'}'}</div>
        </div>
        <p className="text-xs text-zinc-600 mt-3">⚠️ 以上配置通过后端 API 管理，前端仅展示说明。流水线配置功能开发中，完成后将提供可视化编辑界面。</p>
      </GlassSurface>
    </div>
  )
}

function GpuTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">GPU 实例管理</h2>
        <p className="text-sm text-zinc-500 mt-1">管理用于图像/视频渲染的 GPU 计算资源。当前为配置说明入口，实际实例管理依赖后端集成 Vast.ai 或其他 GPU 云服务。</p>
      </div>

      <GlassSurface variant="panel" className="!p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white">🖥️ GPU 实例说明</h3>
        <div className="text-xs text-zinc-400 leading-relaxed space-y-3">
          <p>漫剧生产中，图像生成和视频渲染是计算密集型任务，需要 GPU 加速。系统通过以下方式管理 GPU 资源：</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-zinc-800/40 rounded-lg p-3">
              <div className="font-semibold text-zinc-300 mb-1">🔗 实例连接</div>
              <p className="text-zinc-500">通过 Vast.ai API 或自定义 GPU 节点接入。配置实例的 SSH 连接、API 端口和认证信息。</p>
            </div>
            <div className="bg-zinc-800/40 rounded-lg p-3">
              <div className="font-semibold text-zinc-300 mb-1">💚 健康监控</div>
              <p className="text-zinc-500">实时监控 GPU 利用率、显存占用、温度和任务队列。异常时自动告警。</p>
            </div>
            <div className="bg-zinc-800/40 rounded-lg p-3">
              <div className="font-semibold text-zinc-300 mb-1">📈 自动扩缩容</div>
              <p className="text-zinc-500">根据任务队列深度自动启停实例。低负载时释放闲置实例以节省成本。</p>
            </div>
            <div className="bg-zinc-800/40 rounded-lg p-3">
              <div className="font-semibold text-zinc-300 mb-1">📊 资源用量统计</div>
              <p className="text-zinc-500">按项目/剧集统计 GPU 时长和费用，便于成本追踪和预算管理。</p>
            </div>
          </div>
        </div>
      </GlassSurface>

      <GlassSurface variant="panel" className="!p-5">
        <h3 className="text-sm font-semibold text-white mb-3">⚙️ 推荐配置</h3>
        <div className="bg-zinc-800/60 rounded-lg p-4 font-mono text-xs text-zinc-300 space-y-1">
          <div>{'// GPU 实例配置（后端管理）'}</div>
          <div>{'{'}</div>
          <div>{'  "provider": "vastai",          // vastai | runpod | custom'}</div>
          <div>{'  "gpu_type": "RTX 4090",       // 推荐 24GB+ 显存'}</div>
          <div>{'  "gpu_count": 1,'}</div>
          <div>{'  "max_instances": 3,            // 最大并行实例数'}</div>
          <div>{'  "min_instances": 0,            // 空闲时缩到 0'}</div>
          <div>{'  "auto_scale": true,'}</div>
          <div>{'  "comfyui_port": 8188,'}</div>
          <div>{'  "max_cost_per_hour": 0.5       // 单实例小时费用上限 ($)'}</div>
          <div>{'}'}</div>
        </div>
        <div className="mt-4 text-xs text-zinc-500 space-y-2">
          <p><strong className="text-zinc-400">操作步骤：</strong></p>
          <ol className="list-decimal list-inside space-y-1 text-zinc-600">
            <li>在 Vast.ai 或 RunPod 创建 GPU 实例，安装 ComfyUI 或 Stable Diffusion WebUI</li>
            <li>在上方填写实例的 API 地址和认证信息（后端配置）</li>
            <li>系统会自动检测实例健康状态并分配渲染任务</li>
            <li>在「资产」页面发起渲染时，任务将自动调度到可用 GPU 实例</li>
          </ol>
        </div>
        <p className="text-xs text-zinc-600 mt-3">⚠️ GPU 实例管理功能开发中，完成后将提供可视化实例列表、实时监控面板和一键启停操作。当前请在后端配置文件中管理实例。</p>
      </GlassSurface>
    </div>
  )
}
