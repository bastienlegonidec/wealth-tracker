import { cn } from '@/lib/utils'

export function SectionTitle({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-3 my-8', className)}>
      <span className="font-mono text-[0.65rem] text-muted uppercase tracking-widest whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}
