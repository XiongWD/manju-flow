import GlassSurface from '@/components/ui/primitives/GlassSurface'
import GlassButton from '@/components/ui/primitives/GlassButton'
import GlassChip from '@/components/ui/primitives/GlassChip'
import type { ApiKey } from '@/lib/api-client'

export function ApiKeyList({
  keys,
  loading,
  toggling,
  onToggleActive,
  onRevoke,
}: {
  keys: ApiKey[]
  loading: boolean
  toggling: string | null
  onToggleActive: (key: ApiKey) => void
  onRevoke: (key: ApiKey) => void
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <GlassSurface key={i} className="h-16 animate-pulse">
            <div className="w-full h-full" />
          </GlassSurface>
        ))}
      </div>
    )
  }

  if (keys.length === 0) {
    return (
      <GlassSurface className="flex flex-col items-center justify-center py-24">
        <span className="text-4xl mb-3">🔑</span>
        <span className="text-zinc-400">暂无 API 密钥</span>
        <span className="text-sm text-zinc-600 mt-1">点击上方按钮创建凭证</span>
      </GlassSurface>
    )
  }

  return (
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
              onClick={() => onToggleActive(key)}
              disabled={toggling === key.id}
              size="sm"
              variant="secondary"
            >
              {toggling === key.id ? '...' : key.is_active ? '停用' : '启用'}
            </GlassButton>
            {key.is_active && (
              <GlassButton
                onClick={() => onRevoke(key)}
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
  )
}
