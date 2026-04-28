"use client"

import GlassSurface from '@/components/ui/primitives/GlassSurface'
import GlassButton from '@/components/ui/primitives/GlassButton'
import { useRouter } from 'next/navigation'

export default function Edit剪辑交付Page() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-zinc-950 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <GlassSurface variant="panel" className="text-center space-y-6">
          <h1 className="text-2xl font-bold text-zinc-100">
            剪辑交付
          </h1>
          <p className="text-zinc-400 text-lg">
            项目成片交付与版本管理，即将上线
          </p>
          <div className="pt-4">
            <GlassButton
              variant="secondary"
              onClick={() => router.push('/workspace')}
            >
              返回工作区
            </GlassButton>
          </div>
        </GlassSurface>
      </div>
    </div>
  )
}
