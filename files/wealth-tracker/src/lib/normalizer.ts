/**
 * ============================================================
 *  PATRIMOINE LE GONIDEC — Portfolio Normalizer
 *  wealth-tracker/src/lib/normalizer.ts
 *
 *  Takes the raw portfolio.json and computes:
 *   - PortfolioSummary with all aggregates
 *   - Asset class breakdown
 *   - Geographic breakdown
 *   - Institution breakdown
 *   - Top/worst holdings
 *
 *  Usage:
 *    import rawData from '../data/portfolio.json'
 *    import { normalizePortfolio } from './lib/normalizer'
 *    const portfolio = normalizePortfolio(rawData)
 * ============================================================
 */

import type {
  PortfolioSnapshot,
  PortfolioSummary,
  Account,
  Holding,
  AccountType,
  AssetClass,
  GeographicZone,
  AssetClassBreakdown,
  GeographyBreakdown,
  InstitutionBreakdown,
  TopHolding,
} from '../types'

// ─── Main entry point ─────────────────────────────────────────

export function normalizePortfolio(raw: any): PortfolioSnapshot {
  const accounts: Account[] = raw.accounts.map((a: any) => ({
    ...a,
    institution: raw.institutions[a.institutionId],
  }))

  const summary = computeSummary(accounts)

  return {
    owner: raw.owner,
    snapshotDate: raw.snapshotDate,
    accounts,
    summary,
  }
}

// ─── Summary computation ───────────────────────────────────────

function computeSummary(accounts: Account[]): PortfolioSummary {
  const totalValue = sum(accounts.map((a) => a.totalValue))
  const allHoldings = getAllHoldings(accounts)

  // Global PnL — only where available (exclude fiscal PnL from employee savings)
  const pnlHoldings = allHoldings.filter((h) => h.unrealizedPnL !== undefined)
  const totalUnrealizedPnL = sum(pnlHoldings.map((h) => h.unrealizedPnL!))
  const totalUnrealizedPnLPercent =
    totalValue > 0 ? (totalUnrealizedPnL / (totalValue - totalUnrealizedPnL)) * 100 : 0

  return {
    totalValue,
    totalUnrealizedPnL,
    totalUnrealizedPnLPercent,
    byAccountType: computeByAccountType(accounts),
    byAssetClass: computeByAssetClass(allHoldings, totalValue),
    byGeography: computeByGeography(allHoldings, totalValue),
    byInstitution: computeByInstitution(accounts, totalValue),
    topHoldings: getTopHoldings(accounts, 5),
    worstHoldings: getWorstHoldings(accounts, 5),
  }
}

// ─── By Account Type ───────────────────────────────────────────

function computeByAccountType(accounts: Account[]): Record<AccountType, number> {
  const result: Partial<Record<AccountType, number>> = {}
  for (const account of accounts) {
    result[account.type] = (result[account.type] ?? 0) + account.totalValue
  }
  return result as Record<AccountType, number>
}

// ─── By Asset Class ────────────────────────────────────────────

function computeByAssetClass(
  holdings: HoldingWithAccount[],
  totalValue: number
): AssetClassBreakdown[] {
  const map = new Map<AssetClass, number>()

  for (const { holding } of holdings) {
    const current = map.get(holding.assetClass) ?? 0
    map.set(holding.assetClass, current + holding.currentValue)
  }

  return Array.from(map.entries())
    .map(([assetClass, value]) => ({
      assetClass,
      value,
      percent: pct(value, totalValue),
    }))
    .sort((a, b) => b.value - a.value)
}

// ─── By Geography ──────────────────────────────────────────────

/**
 * Geographic allocation: for multi-zone ETFs we do a naive equal-weight split.
 * In production you'd inject the exact fund factsheets data here.
 */
function computeByGeography(
  holdings: HoldingWithAccount[],
  totalValue: number
): GeographyBreakdown[] {
  const map = new Map<GeographicZone, number>()

  for (const { holding } of holdings) {
    const zones = holding.geography
    const valuePerZone = holding.currentValue / zones.length // naive equal split

    for (const zone of zones) {
      const current = map.get(zone) ?? 0
      map.set(zone, current + valuePerZone)
    }
  }

  return Array.from(map.entries())
    .map(([zone, value]) => ({
      zone,
      value,
      percent: pct(value, totalValue),
    }))
    .sort((a, b) => b.value - a.value)
}

// ─── By Institution ────────────────────────────────────────────

function computeByInstitution(
  accounts: Account[],
  totalValue: number
): InstitutionBreakdown[] {
  const map = new Map<string, { name: string; value: number }>()

  for (const account of accounts) {
    const id = account.institution.id
    const existing = map.get(id)
    if (existing) {
      existing.value += account.totalValue
    } else {
      map.set(id, { name: account.institution.name, value: account.totalValue })
    }
  }

  return Array.from(map.entries())
    .map(([institutionId, { name, value }]) => ({
      institutionId,
      institutionName: name,
      value,
      percent: pct(value, totalValue),
    }))
    .sort((a, b) => b.value - a.value)
}

// ─── Top / Worst Holdings ─────────────────────────────────────

function getTopHoldings(accounts: Account[], n: number): TopHolding[] {
  return getAllHoldings(accounts)
    .sort((a, b) => b.holding.currentValue - a.holding.currentValue)
    .slice(0, n)
    .map(toTopHolding)
}

function getWorstHoldings(accounts: Account[], n: number): TopHolding[] {
  return getAllHoldings(accounts)
    .filter((h) => h.holding.unrealizedPnLPercent !== undefined)
    .sort(
      (a, b) =>
        (a.holding.unrealizedPnLPercent ?? 0) - (b.holding.unrealizedPnLPercent ?? 0)
    )
    .slice(0, n)
    .map(toTopHolding)
}

// ─── Helpers ───────────────────────────────────────────────────

interface HoldingWithAccount {
  holding: Holding
  account: Account
}

function getAllHoldings(accounts: Account[]): HoldingWithAccount[] {
  return accounts.flatMap((account) =>
    account.holdings.map((holding) => ({ holding, account }))
  )
}

function toTopHolding({ holding, account }: HoldingWithAccount): TopHolding {
  return {
    holdingId: holding.id,
    holdingName: holding.name,
    accountId: account.id,
    accountType: account.type,
    value: holding.currentValue,
    unrealizedPnLPercent: holding.unrealizedPnLPercent,
  }
}

function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0)
}

function pct(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 10000) / 100 : 0
}

// ─── Convenience query helpers ────────────────────────────────
// These are thin wrappers you'll call from React components/API routes.

/**
 * Get all holdings for a given asset class across all accounts.
 */
export function getHoldingsByAssetClass(
  portfolio: PortfolioSnapshot,
  assetClass: AssetClass
): HoldingWithAccount[] {
  return getAllHoldings(portfolio.accounts).filter(
    ({ holding }) => holding.assetClass === assetClass
  )
}

/**
 * Get all holdings for a given account type.
 */
export function getHoldingsByAccountType(
  portfolio: PortfolioSnapshot,
  type: AccountType
): HoldingWithAccount[] {
  return portfolio.accounts
    .filter((a) => a.type === type)
    .flatMap((a) => a.holdings.map((h) => ({ holding: h, account: a })))
}

/**
 * Get a single account by id.
 */
export function getAccount(
  portfolio: PortfolioSnapshot,
  id: string
): Account | undefined {
  return portfolio.accounts.find((a) => a.id === id)
}

/**
 * Get total value for a given institution.
 */
export function getTotalByInstitution(
  portfolio: PortfolioSnapshot,
  institutionId: string
): number {
  return sum(
    portfolio.accounts
      .filter((a) => a.institution.id === institutionId)
      .map((a) => a.totalValue)
  )
}

/**
 * Format a value as EUR currency string.
 */
export function formatEUR(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value)
}

/**
 * Format a percentage with sign.
 */
export function formatPct(value: number, decimals = 2): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}
