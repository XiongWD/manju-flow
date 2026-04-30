'use client'

import { Suspense } from 'react'
import { RenderQueueContent } from './components/RenderQueueContent'

export default function RenderQueuePage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center text-zinc-400">加载中...</div>}>
      <RenderQueueContent />
    </Suspense>
  )
}
