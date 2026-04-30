'use client'

import { useEffect, useState } from 'react'
import GlassButton from '@/components/ui/primitives/GlassButton'
import { apiClient, type ApiKey, type ApiKeyCreated } from '@/lib/api-client'
import { ApiKeyGuide } from './ApiKeyGuide'
import { ApiKeyList } from './ApiKeyList'
import { CreateKeyModal, CreatedKeyModal, RevokeKeyModal } from './ApiKeyModals'

export function ApiKeysTab() {
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
      await apiClient.updateApiKey(key.id, { is_active: !key.is_active })
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">接口密钥</h2>
          <p className="text-sm text-zinc-500 mt-1">按媒体类型管理外部服务凭证。漫剧生产需要 LLM、图像、视频、音频、存储、审核等多类 API Key。</p>
        </div>
        <div className="flex items-center gap-2">
          <GlassButton onClick={() => setShowGuide(!showGuide)} variant="secondary" size="sm">
            {showGuide ? '收起引导' : '配置引导'}
          </GlassButton>
          <GlassButton onClick={() => setShowCreate(true)} variant="primary">
            + 创建密钥
          </GlassButton>
        </div>
      </div>

      <ApiKeyGuide keys={keys} show={showGuide} />
      <ApiKeyList
        keys={keys}
        loading={loading}
        toggling={toggling}
        onToggleActive={handleToggleActive}
        onRevoke={setRevoking}
      />

      <CreateKeyModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        keyName={keyName}
        onKeyNameChange={setKeyName}
        keyProvider={keyProvider}
        onKeyProviderChange={setKeyProvider}
        onCreate={handleCreate}
      />
      <CreatedKeyModal
        open={!!createdKey}
        onClose={() => setCreatedKey(null)}
        createdKey={createdKey}
        copied={copied}
        onCopy={handleCopy}
      />
      <RevokeKeyModal
        open={!!revoking}
        onClose={() => setRevoking(null)}
        revoking={revoking}
        onConfirm={handleRevoke}
      />
    </div>
  )
}
