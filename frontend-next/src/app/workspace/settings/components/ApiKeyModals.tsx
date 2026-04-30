import GlassModalShell from '@/components/ui/primitives/GlassModalShell'
import GlassButton from '@/components/ui/primitives/GlassButton'
import GlassInput from '@/components/ui/primitives/GlassInput'
import GlassField from '@/components/ui/primitives/GlassField'
import type { ApiKey, ApiKeyCreated } from '@/lib/api-client'

export function CreateKeyModal({
  open,
  onClose,
  keyName,
  onKeyNameChange,
  keyProvider,
  onKeyProviderChange,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  keyName: string
  onKeyNameChange: (v: string) => void
  keyProvider: string
  onKeyProviderChange: (v: string) => void
  onCreate: () => void
}) {
  return (
    <GlassModalShell
      open={open}
      onClose={onClose}
      title="创建 API 密钥"
      size="sm"
      footer={
        <div className="flex justify-end gap-3">
          <GlassButton onClick={onClose} variant="secondary">取消</GlassButton>
          <GlassButton onClick={onCreate} disabled={!keyName.trim()} variant="primary">创建</GlassButton>
        </div>
      }
    >
      <div className="space-y-4">
        <GlassField label="密钥名称" required>
          <GlassInput
            value={keyName}
            onChange={(e) => onKeyNameChange(e.target.value)}
            placeholder="例如: Kling Production"
          />
        </GlassField>
        <GlassField label="服务商标识">
          <GlassInput
            value={keyProvider}
            onChange={(e) => onKeyProviderChange(e.target.value)}
            placeholder="例如: kling, elevenlabs（可选）"
          />
        </GlassField>
      </div>
    </GlassModalShell>
  )
}

export function CreatedKeyModal({
  open,
  onClose,
  createdKey,
  copied,
  onCopy,
}: {
  open: boolean
  onClose: () => void
  createdKey: ApiKeyCreated | null
  copied: boolean
  onCopy: () => void
}) {
  return (
    <GlassModalShell
      open={open}
      onClose={onClose}
      title="密钥已创建"
      size="sm"
      footer={<GlassButton onClick={onClose} variant="primary">完成</GlassButton>}
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
          <GlassButton onClick={onCopy} size="sm" variant="secondary">
            {copied ? '✓' : '复制'}
          </GlassButton>
        </div>
      </div>
    </GlassModalShell>
  )
}

export function RevokeKeyModal({
  open,
  onClose,
  revoking,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  revoking: ApiKey | null
  onConfirm: () => void
}) {
  return (
    <GlassModalShell
      open={open}
      onClose={onClose}
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
          <GlassButton onClick={onClose} variant="secondary">取消</GlassButton>
          <GlassButton onClick={onConfirm} variant="danger">确认撤销</GlassButton>
        </div>
      }
    >
      <div />
    </GlassModalShell>
  )
}
