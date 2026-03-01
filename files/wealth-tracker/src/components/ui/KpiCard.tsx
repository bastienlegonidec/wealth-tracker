import { cn, formatEUR, formatPct, pnlColor } from '@/lib/utils'

interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  subType?: 'positive' | 'negative' | 'neutral'
  isEur?: boolean
  className?: string
}

export function KpiCard({ label, value, sub, subType = 'neutral', className }: KpiCardProps) {
  const subColor = {
    positive: 'text-accent',
    negative: 'text-danger',
    neutral: 'text-muted',
  }[subType]

  return (
    <div
      className={cn(
        'bg-surface px-6 py-5 transition-colors hover:bg-surface2',
        className
      )}
    >
      <p className="font-mono text-[0.65rem] text-muted uppercase tracking-widest mb-2.5">
        {label}
      </p>
      <p className="font-serif text-[1.65rem] text-[#e8f0d8] leading-none tracking-tight">
        {typeof value === 'number' ? formatEUR(value) : value}
      </p>
      {sub && (
        <p className={cn('font-mono text-[0.7rem] mt-1.5', subColor)}>{sub}</p>
      )}
    </div>
  )
}
