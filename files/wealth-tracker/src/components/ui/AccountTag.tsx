import { ACCOUNT_TYPE_LABEL, ACCOUNT_TYPE_COLOR } from '@/lib/utils'
import type { AccountType } from '@/types'

export function AccountTag({ type }: { type: AccountType }) {
  const label = ACCOUNT_TYPE_LABEL[type]
  const color = ACCOUNT_TYPE_COLOR[type]

  return (
    <span
      className="inline-block px-2 py-0.5 rounded font-mono text-[0.62rem] tracking-wide"
      style={{
        background: `${color}20`,
        color,
        border: `1px solid ${color}40`,
      }}
    >
      {label}
    </span>
  )
}
