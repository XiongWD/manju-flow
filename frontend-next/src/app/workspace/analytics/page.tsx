'use client'

import { BarChart3, Clock } from 'lucide-react'
import { GlassSurface } from '@/components/ui/primitives'

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      {/* ── 页面标题 ── */}
      <div>
        <div className="text-sm font-medium text-zinc-500 mb-2">数据与分析</div>
        <h1 className="text-2xl font-semibold text-white">数据分析</h1>
      </div>

      {/* ── 占位内容 ── */}
      <GlassSurface variant="card" interactive={false}>
        <div className="flex flex-col items-center justify-center py-20">
          <div className="mb-6 flex items-center justify-center w-20 h-20 rounded-full bg-zinc-800/50">
            <BarChart3 className="h-10 w-10 text-zinc-600" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-3">项目制作数据统计与分析</h3>
          <p className="text-sm text-zinc-500 text-center max-w-md mb-6">
            即将上线
          </p>
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <Clock className="h-3.5 w-3.5" />
            <span>功能开发中，敬请期待</span>
          </div>
        </div>
      </GlassSurface>
    </div>
  )
}
