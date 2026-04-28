import type { ReactNode } from 'react'

type PageHeaderProps = {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex items-start justify-between gap-6">
        <div className="max-w-lg">
          {eyebrow ? (
            <div className="mb-2 text-sm font-medium tracking-wide text-zinc-500">{eyebrow}</div>
          ) : null}
          <h1 className="text-3xl font-bold text-zinc-100">{title}</h1>
          {description ? <p className="mt-4 max-w-md text-base text-zinc-400">{description}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </div>
  )
}
