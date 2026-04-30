import GlassSurface from '@/components/ui/primitives/GlassSurface'
import GlassChip from '@/components/ui/primitives/GlassChip'
import type { ApiKey } from '@/lib/api-client'

export const API_KEY_CATEGORIES = [
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

export function ApiKeyGuide({ keys, show }: { keys: ApiKey[]; show: boolean }) {
  if (!show) return null

  return (
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
  )
}
