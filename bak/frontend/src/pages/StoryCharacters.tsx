import { Card, CardContent } from '@/components/ui/card'
import { BookOpen } from 'lucide-react'

export default function StoryCharacters() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">剧本与角色</h1>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <BookOpen className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h3 className="text-lg font-semibold">故事大纲与角色设计</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-md text-center">
            故事结构管理、角色档案与参考图、AI 辅助故事生成将在 Phase 1 上线。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
