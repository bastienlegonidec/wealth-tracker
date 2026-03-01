import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { AccountType, AssetClass, GeographicZone } from '@/types'

// ─── Tailwind class merger ────────────────────────────────────

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Number formatting ────────────────────────────────────────
// ⚠ Hydration fix: Intl.NumberFormat 'compact' notation produces different
// output between Node.js ICU and macOS Safari/Chrome (e.g. "5 k €" vs "5,0 k €").
// Solution: hand-roll compact formatting so server & client always agree.

export function formatEUR(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1000) {
    const k = value / 1000
    const formatted = k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)
    return `${formatted} k€`
  }
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatPct(value: number, showSign = true): string {
  const sign = showSign && value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

export function formatNumber(value: number, decimals = 4): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value)
}

// ─── PnL color helpers ────────────────────────────────────────

export function pnlColor(value: number): string {
  if (value > 0) return 'text-accent'
  if (value < 0) return 'text-danger'
  return 'text-muted'
}

export function pnlBg(value: number): string {
  if (value > 0) return 'bg-accent/10 border-accent/20'
  if (value < 0) return 'bg-danger/10 border-danger/20'
  return 'bg-surface2 border-border'
}

// ─── Account type labels & colors ────────────────────────────

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  PEA: 'PEA',
  CTO: 'CTO',
  LIVRET_A: 'Livret A',
  AV: 'Assur. Vie',
  PEE: 'PEE',
  PERCO: 'PERCO',
  PERCOL: 'PER COL',
  CRYPTO: 'Crypto',
}

export const ACCOUNT_TYPE_COLOR: Record<AccountType, string> = {
  PEA: '#a8d060',
  CTO: '#6098d0',
  LIVRET_A: '#60d098',
  AV: '#d4a84b',
  PEE: '#e07040',
  PERCO: '#a860d0',
  PERCOL: '#e09040',
  CRYPTO: '#d4d04b',
}

// ─── Asset class labels & colors ─────────────────────────────

export const ASSET_CLASS_LABEL: Record<AssetClass, string> = {
  EQUITIES: 'Actions',
  BONDS: 'Obligataire / Fonds €',
  MONEY_MARKET: 'Monétaire',
  REAL_ESTATE: 'Immobilier',
  CRYPTO: 'Crypto-actifs',
  CASH: 'Liquidités',
  MIXED: 'Mixte / Diversifié',
  UNKNOWN: 'Non classifié',
}

export const ASSET_CLASS_COLOR: Record<AssetClass, string> = {
  EQUITIES: '#a8d060',
  BONDS: '#d4a84b',
  MONEY_MARKET: '#60d098',
  REAL_ESTATE: '#e09040',
  CRYPTO: '#d4d04b',
  CASH: '#6b7d54',
  MIXED: '#6098d0',
  UNKNOWN: '#3a4530',
}

// ─── Geography labels & colors ────────────────────────────────

export const GEO_LABEL: Record<GeographicZone, string> = {
  US: '🇺🇸 Amérique du Nord',
  EUROPE: '🇪🇺 Europe',
  FRANCE: '🇫🇷 France',
  EMERGING_ASIA: '🌏 Asie Émergente',
  JAPAN: '🇯🇵 Japon',
  GLOBAL: '🌍 Global',
  CRYPTO_GLOBAL: '🔗 Crypto Global',
  UNKNOWN: '❓ Non géolocalisé',
}

export const GEO_COLOR: Record<GeographicZone, string> = {
  US: '#6098d0',
  EUROPE: '#a8d060',
  FRANCE: '#60d098',
  EMERGING_ASIA: '#d4a84b',
  JAPAN: '#e86060',
  GLOBAL: '#a860d0',
  CRYPTO_GLOBAL: '#d4d04b',
  UNKNOWN: '#3a4530',
}

// ─── Risk level ───────────────────────────────────────────────

export function riskLabel(level: number): string {
  const labels = ['', 'Très faible', 'Faible', 'Modéré faible', 'Modéré', 'Modéré élevé', 'Élevé', 'Très élevé']
  return labels[level] ?? '—'
}

export function riskColor(level: number): string {
  const colors = ['', '#60d098', '#a8d060', '#d4d04b', '#e09040', '#e07040', '#e86060', '#c03030']
  return colors[level] ?? '#6b7d54'
}
