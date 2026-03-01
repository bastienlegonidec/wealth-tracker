import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        'bg-surface border border-border rounded-xl overflow-hidden',
        className
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  children,
  className,
}: CardProps) {
  return (
    <div
      className={cn(
        'px-6 py-4 border-b border-border flex items-center justify-between',
        className
      )}
    >
      {children}
    </div>
  )
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-serif text-[1.05rem] text-[#e8f0d8]">{children}</h3>
  )
}

export function CardBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[0.65rem] px-2.5 py-1 rounded-full bg-surface2 border border-border text-muted uppercase tracking-widest">
      {children}
    </span>
  )
}

export function CardBody({ children, className }: CardProps) {
  return <div className={cn('p-6', className)}>{children}</div>
}
