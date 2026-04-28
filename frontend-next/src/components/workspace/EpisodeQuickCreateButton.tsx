'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GlassButton } from '@/components/ui/primitives'
import { apiClient } from '@/lib/api-client'

export function EpisodeQuickCreateButton({ projectId, nextEpisodeNo }: { projectId: string; nextEpisodeNo: number }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    try {
      setLoading(true)
      await apiClient.createEpisode({
        project_id: projectId,
        episode_no: nextEpisodeNo,
        title: `第${nextEpisodeNo}集`,
        status: 'draft',
      })
      router.refresh()
    } catch (error) {
      console.error('创建剧集失败', error)
      alert('创建剧集失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <GlassButton variant="secondary" size="sm" onClick={handleCreate} disabled={loading}>
      {loading ? '创建中...' : '新增剧集'}
    </GlassButton>
  )
}
