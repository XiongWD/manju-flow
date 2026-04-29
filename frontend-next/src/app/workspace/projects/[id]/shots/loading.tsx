export default function ProjectShotsLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 p-4 md:p-6 lg:p-8">
      <div className="mb-6 space-y-3">
        <div className="h-5 w-32 animate-pulse rounded bg-white/[0.04]" />
        <div className="h-8 w-48 animate-pulse rounded bg-white/[0.04]" />
      </div>
      <div className="mb-6 flex gap-2 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-9 w-28 animate-pulse rounded-full bg-white/[0.04]" />)}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-52 animate-pulse rounded-2xl bg-white/[0.04]" />)}
      </div>
    </div>
  )
}
