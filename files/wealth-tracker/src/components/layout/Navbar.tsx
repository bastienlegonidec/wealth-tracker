import Link from 'next/link'

export function Navbar() {
  return (
    <nav className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="w-6 h-6 rounded bg-accent/20 border border-accent/40 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-accent" />
          </div>
          <span className="font-serif text-[1rem] text-[#e8f0d8]">
            Patrimoine <span className="text-accent">LE GONIDEC</span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <NavLink href="/dashboard">Dashboard</NavLink>
          <NavLink href="/accounts">Comptes</NavLink>
        </div>

        <div className="font-mono text-[0.65rem] text-muted uppercase tracking-widest">
          Snapshot · 28/02/2026
        </div>
      </div>
    </nav>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-4 py-1.5 rounded-lg font-mono text-[0.72rem] text-muted hover:text-[#e8f0d8] hover:bg-surface2 transition-colors uppercase tracking-wide"
    >
      {children}
    </Link>
  )
}
