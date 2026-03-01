'use client'

import { cn, formatEUR, formatPct, pnlColor } from '@/lib/utils'

interface BarItem {
  label: string
  value: number
  pnl?: number
  pnlPct?: number
  color?: string
  maxValue?: number
}

interface HBarChartProps {
  items: BarItem[]
  maxValue?: number
}

export function HBarChart({ items, maxValue }: HBarChartProps) {
  const absMax = maxValue ?? Math.max(...items.map((i) => Math.abs(i.pnlPct ?? i.value)))

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => {
        const ref = item.pnlPct ?? item.value
        const width = Math.min(100, (Math.abs(ref) / absMax) * 100)
        const isNeg = ref < 0
        const barColor = item.color ?? (isNeg ? '#e86060' : '#a8d060')

        return (
          <div key={i} className="flex items-center gap-3">
            <span className="text-[0.78rem] text-muted min-w-[180px] truncate">
              {item.label}
            </span>
            <div className="flex-1 h-[6px] bg-surface2 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${width}%`, background: barColor }}
              />
            </div>
            <span className="font-mono text-[0.72rem] text-[#e8f0d8] min-w-[80px] text-right">
              {formatEUR(item.value)}
            </span>
            {item.pnl !== undefined && (
              <span
                className={cn(
                  'font-mono text-[0.7rem] min-w-[70px] text-right',
                  pnlColor(item.pnl)
                )}
              >
                {item.pnl >= 0 ? '+' : ''}{formatEUR(item.pnl)}
              </span>
            )}
            {item.pnlPct !== undefined && (
              <span
                className={cn(
                  'font-mono text-[0.7rem] min-w-[58px] text-right',
                  pnlColor(item.pnlPct)
                )}
              >
                {formatPct(item.pnlPct)}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
