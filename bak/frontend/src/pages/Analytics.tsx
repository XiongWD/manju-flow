import { Card, CardContent } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'

export default function Analytics() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">数据分析</h1>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h3 className="text-lg font-semibold">生产数据分析</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-md text-center">
            单集成本追踪、渲染耗时分析、质检通过率、预算预测将在 Phase 2 上线。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
