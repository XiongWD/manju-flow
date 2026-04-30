export function TabButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  icon: string
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
        active
          ? 'text-white border-white bg-white/[0.02]'
          : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-white/[0.01]'
      }`}
    >
      <span className="mr-2">{icon}</span>
      {label}
    </button>
  )
}
