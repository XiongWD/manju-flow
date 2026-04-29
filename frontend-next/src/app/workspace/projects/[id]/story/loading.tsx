export default function ProjectStoryLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 p-4 md:p-6 lg:p-8">
      <div className="mb-6 space-y-3">
        <div className="h-5 w-36 animate-pulse rounded bg-white/[0.04]" />
        <div className="h-8 w-40 animate-pulse rounded bg-white/[0.04]" />
      </div>
      <div className="space-y-6">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-white/[0.04]" />)}
      </div>
    </div>
  )
}
