import { Card, CardContent } from '@/components/ui/card'
import { Clapperboard } from 'lucide-react'

export default function ShotEditor() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">镜头编辑</h1>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Clapperboard className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h3 className="text-lg font-semibold">场景与镜头编辑器</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-md text-center">
            视觉镜头拆分、分镜编辑、版本差异对比、AI 图像生成集成将在 Phase 1 上线。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
