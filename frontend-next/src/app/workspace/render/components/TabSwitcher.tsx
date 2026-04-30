interface Props {
  activeTab: 'queue' | 'history'
  onChange: (tab: 'queue' | 'history') => void
}

export function TabSwitcher({ activeTab, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange('queue')}
        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
          activeTab === 'queue'
            ? 'bg-zinc-800 text-white border border-zinc-700'
            : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'
        }`}
      >
        场景生产队列
      </button>
      <button
        onClick={() => onChange('history')}
        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
          activeTab === 'history'
            ? 'bg-zinc-800 text-white border border-zinc-700'
            : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'
        }`}
      >
        任务历史
      </button>
    </div>
  )
}
