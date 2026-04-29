import GlassSurface from './GlassSurface'

export default function GlassLoadingBlock({
  message = '加载中…',
  className = '',
}: {
  message?: string
  className?: string
}) {
  return (
    <GlassSurface variant="panel" className={`py-16 text-center ${className}`}>
      <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-white/45" />
      <p className="text-sm text-zinc-500">{message}</p>
    </GlassSurface>
  )
}
