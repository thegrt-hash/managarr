import clsx from 'clsx'

const config = {
  good: { label: 'Good', cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  questionable: { label: 'Questionable', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  needs_review: { label: 'Needs Review', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
}

export default function ScoreBadge({ label, score }: { label: string; score?: number }) {
  const c = config[label as keyof typeof config] ?? config.needs_review
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium', c.cls)}>
      {c.label}{score !== undefined && <span className="opacity-70">· {score}</span>}
    </span>
  )
}
