'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatEUR, formatPct } from '@/lib/utils'

interface DonutSlice {
  name: string
  value: number
  color: string
  percent?: number
}

interface DonutChartProps {
  data: DonutSlice[]
  centerLabel?: string
  centerValue?: string
  height?: number
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload?.length) {
    const item = payload[0].payload
    return (
      <div className="bg-surface2 border border-border rounded-lg px-3 py-2 shadow-lg">
        <p className="font-mono text-[0.7rem] text-muted mb-1">{item.name}</p>
        <p className="font-mono text-[0.8rem] text-[#e8f0d8]">{formatEUR(item.value)}</p>
        {item.percent !== undefined && (
          <p className="font-mono text-[0.7rem] text-muted">{formatPct(item.percent, 1)}</p>
        )}
      </div>
    )
  }
  return null
}

export function DonutChart({
  data,
  centerLabel,
  centerValue,
  height = 200,
}: DonutChartProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Chart */}
      <div className="relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={height * 0.28}
              outerRadius={height * 0.42}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center text */}
        {(centerLabel || centerValue) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {centerValue && (
              <p className="font-serif text-[1.1rem] text-accent2 leading-none">
                {centerValue}
              </p>
            )}
            {centerLabel && (
              <p className="font-mono text-[0.58rem] text-muted uppercase tracking-widest mt-1">
                {centerLabel}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-2">
        {data.map((item, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: item.color }}
            />
            <span className="text-muted text-[0.78rem] flex-1 truncate">
              {item.name}
            </span>
            <span className="font-mono text-[0.72rem] text-[#e8f0d8]">
              {formatEUR(item.value, true)}
            </span>
            {item.percent !== undefined && (
              <span className="font-mono text-[0.68rem] text-muted min-w-[3rem] text-right">
                {item.percent.toFixed(1)}%
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
