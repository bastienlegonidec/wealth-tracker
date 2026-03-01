'use client'

import { useBinance } from '@/hooks/useBinance'
import { formatEUR, formatPct, pnlColor, cn } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardBadge, CardBody } from '@/components/ui/Card'

// Crypto color map
const CRYPTO_COLORS: Record<string, string> = {
  BTC: '#f7931a',
  ETH: '#627eea',
  BNB: '#f3ba2f',
  SOL: '#9945ff',
  USDC: '#2775ca',
  USDT: '#26a17b',
  EUR: '#60d098',
}

function getCryptoColor(asset: string): string {
  return CRYPTO_COLORS[asset] ?? '#a8d060'
}

export function BinanceWidget() {
  const { snapshot, status, error, lastFetchedAt, refetch } = useBinance({
    skipPnL: false,
    refreshInterval: 60_000,
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <CardTitle>Binance Wallet</CardTitle>
          {/* Live indicator */}
          <span className="flex items-center gap-1.5">
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                status === 'loading' ? 'bg-gold animate-pulse' :
                status === 'success' ? 'bg-accent animate-pulse' :
                status === 'error' ? 'bg-danger' :
                'bg-muted'
              )}
            />
            <span className="font-mono text-[0.6rem] text-muted uppercase tracking-widest">
              {status === 'loading' ? 'Syncing…' :
               status === 'success' ? 'Live' :
               status === 'error' ? 'Erreur' : 'Idle'}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {lastFetchedAt && (
            <span className="font-mono text-[0.6rem] text-muted">
              {new Date(lastFetchedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            onClick={refetch}
            disabled={status === 'loading'}
            className="font-mono text-[0.65rem] px-2.5 py-1 rounded border border-border text-muted hover:text-[#e8f0d8] hover:border-accent/40 transition-colors disabled:opacity-40"
          >
            ↻ Refresh
          </button>
          <CardBadge>Binance</CardBadge>
        </div>
      </CardHeader>

      <CardBody>
        {/* Error state */}
        {status === 'error' && (
          <div className="bg-danger/10 border border-danger/20 rounded-lg p-4 mb-4">
            <p className="font-mono text-[0.7rem] text-danger mb-1">⚠ Connexion Binance échouée</p>
            <p className="text-[0.78rem] text-muted">{error}</p>
            <p className="font-mono text-[0.65rem] text-muted mt-2">
              Vérifier BINANCE_API_KEY et BINANCE_SECRET_KEY dans .env.local
            </p>
          </div>
        )}

        {/* Loading skeleton */}
        {status === 'loading' && !snapshot && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-surface2" />
                <div className="flex-1 h-3 bg-surface2 rounded" />
                <div className="w-20 h-3 bg-surface2 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Success state */}
        {snapshot && (
          <div className="flex flex-col gap-4">
            {/* Total */}
            <div className="flex items-end justify-between pb-4 border-b border-border">
              <div>
                <p className="font-mono text-[0.65rem] text-muted uppercase tracking-widest mb-1">
                  Total wallet
                </p>
                <p className="font-serif text-[1.8rem] text-accent2 leading-none">
                  {formatEUR(snapshot.totalValueEUR)}
                </p>
              </div>
              {snapshot.totalPnlEUR !== undefined && (
                <div className="text-right">
                  <p className="font-mono text-[0.65rem] text-muted uppercase tracking-widest mb-1">
                    P&L estimé
                  </p>
                  <p className={cn('font-mono text-[0.9rem]', pnlColor(snapshot.totalPnlEUR))}>
                    {snapshot.totalPnlEUR >= 0 ? '+' : ''}
                    {formatEUR(snapshot.totalPnlEUR)}
                  </p>
                </div>
              )}
            </div>

            {/* Holdings list */}
            <div className="flex flex-col gap-1">
              {snapshot.holdings.map((h) => {
                const color = getCryptoColor(h.asset)
                const pct = (h.valueEUR / snapshot.totalValueEUR) * 100

                return (
                  <div
                    key={h.asset}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface2 transition-colors group"
                  >
                    {/* Icon */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-mono text-[0.65rem] font-bold"
                      style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
                    >
                      {h.asset.slice(0, 3)}
                    </div>

                    {/* Name + qty */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[0.85rem] font-semibold text-[#e8f0d8]">
                          {h.asset}
                        </span>
                        {h.isStablecoin && (
                          <span className="font-mono text-[0.58rem] text-muted border border-border px-1 py-0.5 rounded">
                            stable
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-[0.65rem] text-muted">
                        {h.quantity.toLocaleString('fr-FR', {
                          maximumFractionDigits: 6,
                          minimumFractionDigits: 0,
                        })}
                        {' '}@ {formatEUR(h.priceEUR)}
                      </p>
                    </div>

                    {/* Weight bar */}
                    <div className="w-16 h-1 bg-surface2 rounded-full overflow-hidden hidden group-hover:hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>

                    {/* Value + PnL */}
                    <div className="text-right flex-shrink-0">
                      <p className="font-mono text-[0.82rem] text-[#e8f0d8]">
                        {formatEUR(h.valueEUR)}
                      </p>
                      <p className="font-mono text-[0.65rem] text-muted">
                        {pct.toFixed(1)}%
                      </p>
                    </div>

                    {/* PnL column */}
                    {h.pnlEUR !== undefined ? (
                      <div className="text-right flex-shrink-0 min-w-[80px]">
                        <p className={cn('font-mono text-[0.76rem]', pnlColor(h.pnlEUR))}>
                          {h.pnlEUR >= 0 ? '+' : ''}{formatEUR(h.pnlEUR)}
                        </p>
                        {h.pnlPercent !== undefined && (
                          <p className={cn('font-mono text-[0.65rem]', pnlColor(h.pnlPercent))}>
                            {formatPct(h.pnlPercent)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="min-w-[80px]" />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-border flex justify-between items-center">
              <p className="font-mono text-[0.62rem] text-muted">
                {snapshot.holdings.length} actifs · refresh auto 60s
              </p>
              <p className="font-mono text-[0.62rem] text-muted">
                Prix : Binance spot · P&L : prix moyen d'achat pondéré
              </p>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
