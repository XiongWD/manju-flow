import { CheckCircle2, AlertCircle } from 'lucide-react'

export type GlassToastItem = {
  id: number | string
  message: string
  type?: 'success' | 'error' | 'info'
}

export function GlassToastContainer({ toasts }: { toasts: GlassToastItem[] }) {
  if (!toasts.length) return null

  return (
    <div className="fixed bottom-6 right-6 z-[120] space-y-2">
      {toasts.map((t) => {
        const type = t.type ?? 'success'
        const styles = {
          success: 'bg-emerald-900/85 text-emerald-100 border-emerald-700/50',
          error: 'bg-rose-900/85 text-rose-100 border-rose-700/50',
          info: 'bg-blue-900/85 text-blue-100 border-blue-700/50',
        }
        return (
          <div
            key={t.id}
            className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg backdrop-blur-md animate-in slide-in-from-right-4 ${styles[type]}`}
          >
            {type === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            <span>{t.message}</span>
          </div>
        )
      })}
    </div>
  )
}

export default GlassToastContainer
