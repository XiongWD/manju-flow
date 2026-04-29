import { Card, CardContent } from '@/components/ui/card'
import { Package } from 'lucide-react'

export default function EditDelivery() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">剪辑与交付</h1>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Package className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h3 className="text-lg font-semibold">视频剪辑与发布</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-md text-center">
            剧集组装、配音同步、字幕生成、多平台发布将在 Phase 2 上线。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
