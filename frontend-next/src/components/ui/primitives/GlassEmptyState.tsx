import type { ReactNode } from 'react'
import GlassSurface from './GlassSurface'

export default function GlassEmptyState({
  title,
  description,
  actions,
  compact = false,
}: {
  title: string
  description?: string
  actions?: ReactNode
  compact?: boolean
}) {
  return (
    <GlassSurface variant="panel" className={compact ? 'py-10 text-center' : 'py-16 text-center'}>
      <div className="mx-auto max-w-md space-y-2">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {description ? <p className="text-sm leading-relaxed text-zinc-500">{description}</p> : null}
        {actions ? <div className="pt-3">{actions}</div> : null}
      </div>
    </GlassSurface>
  )
}
