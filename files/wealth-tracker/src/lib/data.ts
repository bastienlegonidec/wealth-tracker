/**
 * Server-only data loader.
 * In production, replace getPortfolio() with your DB / API calls.
 */

import type { PortfolioSnapshot, Account, Holding } from '@/types'
import { normalizePortfolio } from '@/lib/normalizer'
import type { BinanceSnapshot } from '@/lib/connectors/binance'
import { binanceSnapshotToHoldings } from '@/lib/connectors/binance'
import rawData from '@/data/portfolio.json'

// ─── Static portfolio singleton ───────────────────────────────

let _portfolio: PortfolioSnapshot | null = null

export function getPortfolio(): PortfolioSnapshot {
  if (!_portfolio) {
    _portfolio = normalizePortfolio(rawData)
  }
  return _portfolio
}

export function getAccount(id: string): Account | undefined {
  return getPortfolio().accounts.find((a) => a.id === id)
}

export function getSummary() {
  return getPortfolio().summary!
}

// ─── Live Binance merger ───────────────────────────────────────

/**
 * Returns a copy of the portfolio with the Binance wallet account
 * replaced by live data from a BinanceSnapshot.
 * The static portfolio is NOT mutated.
 */
export function mergeWithLiveBinance(
  snapshot: BinanceSnapshot
): PortfolioSnapshot {
  const base = getPortfolio()
  const liveHoldings = binanceSnapshotToHoldings(snapshot)

  const updatedAccounts = base.accounts.map((account): Account => {
    if (account.id !== 'binance-wallet') return account

    const totalValue = snapshot.totalValueEUR
    const cashBalance = liveHoldings
      .filter((h) => h.assetClass === 'CASH')
      .reduce((s, h) => s + h.currentValue, 0)

    return {
      ...account,
      snapshotDate: snapshot.fetchedAt.split('T')[0],
      totalValue,
      cashBalance,
      securitiesValue: totalValue - cashBalance,
      unrealizedPnL: snapshot.totalPnlEUR,
      unrealizedPnLPercent:
        snapshot.totalPnlEUR !== undefined && totalValue > 0
          ? (snapshot.totalPnlEUR / (totalValue - (snapshot.totalPnlEUR ?? 0))) * 100
          : undefined,
      holdings: liveHoldings as Holding[],
    }
  })

  return normalizePortfolio({
    ...rawData,
    accounts: updatedAccounts.map((a) => ({
      ...a,
      institutionId: a.institution.id,
    })),
  })
}

// ─── Optional: server-side live fetch ─────────────────────────

/**
 * Fetches live Binance data server-side and returns merged portfolio.
 * Falls back to static portfolio if env vars are missing or fetch fails.
 */
export async function getPortfolioWithLiveBinance(): Promise<PortfolioSnapshot> {
  const apiKey = process.env.BINANCE_API_KEY
  const secret = process.env.BINANCE_SECRET_KEY

  if (!apiKey || !secret) {
    console.warn('[data] Binance env vars not set — using static snapshot')
    return getPortfolio()
  }

  try {
    const { fetchBinanceSnapshot } = await import('@/lib/connectors/binance')
    const snapshot = await fetchBinanceSnapshot(apiKey, secret, false)
    return mergeWithLiveBinance(snapshot)
  } catch (err) {
    console.error('[data] Live Binance fetch failed — falling back to static', err)
    return getPortfolio()
  }
}
