"use client"

import GlassSurface from '@/components/ui/primitives/GlassSurface'
import GlassButton from '@/components/ui/primitives/GlassButton'
import { useParams, useRouter } from 'next/navigation'

export default function StoryCharactersPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  return (
    <div className="min-h-screen bg-zinc-950 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <GlassSurface variant="panel" className="text-center space-y-6">
          <h1 className="text-2xl font-bold text-zinc-100">
            故事与角色
          </h1>
          <p className="text-zinc-400 text-lg">
            管理项目的故事线与角色设定，即将上线
          </p>
          <div className="pt-4">
            <GlassButton
              variant="secondary"
              onClick={() => router.push(`/workspace/projects/${projectId}`)}
            >
              返回项目
            </GlassButton>
          </div>
        </GlassSurface>
      </div>
    </div>
  )
}
