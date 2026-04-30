import type { EpisodeWithScenes } from '@/types'

interface Props {
  episodes: EpisodeWithScenes[]
  currentEpisodeId: string | undefined
  onSelect: (ep: EpisodeWithScenes) => void
}

export function EpisodeSelector({ episodes, currentEpisodeId, onSelect }: Props) {
  if (episodes.length === 0) return null
  return (
    <div className="flex items-center gap-2">
      {episodes.map((ep) => (
        <button
          key={ep.id}
          onClick={() => onSelect(ep)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            currentEpisodeId === ep.id
              ? 'bg-zinc-800 text-white border border-zinc-700'
              : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'
          }`}
        >
          第 {ep.episode_no} 集
          {ep.title ? ` · ${ep.title}` : ''}
        </button>
      ))}
    </div>
  )
}
