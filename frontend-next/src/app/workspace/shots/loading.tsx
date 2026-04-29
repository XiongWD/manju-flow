export default function ShotsLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <div className="mb-6 h-16 animate-pulse rounded-2xl bg-white/[0.04]" />
      <div className="mb-6 h-10 max-w-sm animate-pulse rounded-xl bg-white/[0.04]" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-white/[0.04]" />
        ))}
      </div>
    </div>
  )
}
