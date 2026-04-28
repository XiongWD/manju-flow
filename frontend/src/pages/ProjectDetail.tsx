import { Navigate, useParams } from 'react-router-dom'

/** 项目详情页 — Phase 0 暂时重定向（占位） */
export default function ProjectDetail() {
  const { id } = useParams()
  // Phase 0.4 暂不实现 episodes 页面，显示占位
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">项目 {id}</h1>
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-lg font-medium">剧集与场景</p>
        <p className="mt-2 text-sm text-muted-foreground">
          剧集管理、场景拆分、版本历史将在 Phase 1 上线。
        </p>
      </div>
    </div>
  )
}
