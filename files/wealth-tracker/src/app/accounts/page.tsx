import { getPortfolio } from '@/lib/data'
import Link from 'next/link'
import {
  formatEUR,
  formatPct,
  pnlColor,
  ACCOUNT_TYPE_LABEL,
  ACCOUNT_TYPE_COLOR,
  cn,
} from '@/lib/utils'
import { Navbar } from '@/components/layout/Navbar'
import { Card } from '@/components/ui/Card'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { AccountTag } from '@/components/ui/AccountTag'

export default function AccountsPage() {
  const portfolio = getPortfolio()
  const accounts = portfolio.accounts
  const summary = portfolio.summary!

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="max-w-[1400px] mx-auto px-6 pb-16">
        <header className="py-10 border-b border-border">
          <h1 className="font-serif text-[2.2rem] leading-none tracking-tight">
            Mes <span className="text-accent">Comptes</span>
          </h1>
          <p className="font-mono text-[0.72rem] text-muted uppercase tracking-widest mt-2">
            {accounts.length} comptes · {formatEUR(summary.totalValue)} total
          </p>
        </header>

        <SectionTitle>Tous les comptes</SectionTitle>

        <div className="flex flex-col gap-4">
          {accounts.map((account) => {
            const color = ACCOUNT_TYPE_COLOR[account.type] ?? '#6b7d54'
            const pnl = account.unrealizedPnL ?? account.fiscalPnL
            const pnlPct = account.unrealizedPnLPercent
            const weight = (account.totalValue / summary.totalValue) * 100

            return (
              <Card key={account.id}>
                <div className="flex items-stretch" style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
                  {/* Main info */}
                  <div className="flex-1 p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <AccountTag type={account.type} />
                          <span className="font-mono text-[0.65rem] text-muted">
                            {account.institution.name}
                          </span>
                          {account.accountNumber && (
                            <span className="font-mono text-[0.62rem] text-muted/60">
                              #{account.accountNumber}
                            </span>
                          )}
                        </div>
                        <h3 className="text-[0.95rem] font-semibold text-[#e8f0d8]">
                          {account.name}
                        </h3>
                        {account.managementMode && (
                          <p className="font-mono text-[0.62rem] text-muted mt-0.5">
                            {account.managementMode === 'FREE' ? 'Gestion libre'
                              : account.managementMode === 'PILOTED' ? `Gestion pilotée · ${account.managementProfile ?? ''}`
                              : 'Robo-advisor'}
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        <p className="font-serif text-[1.6rem] text-accent2 leading-none">
                          {formatEUR(account.totalValue)}
                        </p>
                        <p className="font-mono text-[0.65rem] text-muted mt-1">
                          {weight.toFixed(1)}% du patrimoine
                        </p>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-6 pt-3 border-t border-border/50">
                      <Stat label="Espèces" value={formatEUR(account.cashBalance)} />
                      <Stat label="Titres" value={formatEUR(account.securitiesValue)} />
                      {pnl !== undefined && (
                        <Stat
                          label={account.fiscalPnL ? '+/- Fiscal' : '+/- Latent'}
                          value={`${pnl >= 0 ? '+' : ''}${formatEUR(pnl)}`}
                          className={pnlColor(pnl)}
                        />
                      )}
                      {pnlPct !== undefined && (
                        <Stat
                          label="Performance"
                          value={formatPct(pnlPct)}
                          className={pnlColor(pnlPct)}
                        />
                      )}
                      <Stat label="Positions" value={`${account.holdings.length}`} />
                    </div>
                  </div>

                  {/* Holdings preview */}
                  <div className="w-64 border-l border-border p-4 flex flex-col gap-1.5 bg-surface2/40">
                    <p className="font-mono text-[0.6rem] text-muted uppercase tracking-widest mb-2">
                      Top positions
                    </p>
                    {account.holdings
                      .slice()
                      .sort((a, b) => b.currentValue - a.currentValue)
                      .slice(0, 4)
                      .map((h) => (
                        <div key={h.id} className="flex items-center justify-between gap-2">
                          <span className="text-[0.72rem] text-muted truncate flex-1">{h.name}</span>
                          <span className="font-mono text-[0.68rem] text-[#e8f0d8] flex-shrink-0">
                            {formatEUR(h.currentValue, true)}
                          </span>
                        </div>
                      ))}
                    {account.holdings.length > 4 && (
                      <p className="font-mono text-[0.62rem] text-muted/60 mt-1">
                        +{account.holdings.length - 4} autres…
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </main>
    </div>
  )
}

function Stat({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div>
      <p className="font-mono text-[0.6rem] text-muted uppercase tracking-wide">{label}</p>
      <p className={cn('font-mono text-[0.75rem] text-[#e8f0d8] mt-0.5', className)}>
        {value}
      </p>
    </div>
  )
}
