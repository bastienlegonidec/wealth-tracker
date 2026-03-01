/**
 * ============================================================
 *  BINANCE CONNECTOR
 *  src/lib/connectors/binance.ts
 *
 *  Endpoints utilisés (tous READ-ONLY, permission "Read" suffisante) :
 *    GET /api/v3/account          → balances spot
 *    GET /api/v3/ticker/price     → prix live (multi-symbol en un seul appel)
 *    GET /api/v3/myTrades         → trades pour calculer le prix moyen d'achat
 *
 *  Sécurité :
 *    - Les clés ne transitent JAMAIS côté client
 *    - Signature HMAC-SHA256 calculée server-side (Next.js API route)
 *    - Les clés sont lues depuis les variables d'environnement uniquement
 * ============================================================
 */

import crypto from 'crypto'

// ─── Config ───────────────────────────────────────────────────

const BASE_URL = 'https://api.binance.com'

// Actifs considérés comme stablecoins (valorisés 1:1 USD→EUR)
const STABLECOINS = new Set(['USDT', 'USDC', 'BUSD', 'DAI', 'FDUSD', 'TUSD'])

// Actifs à ignorer (trop petits, dust, locked)
const MIN_VALUE_EUR = 0.50

// ─── Types ────────────────────────────────────────────────────

export interface BinanceBalance {
  asset: string
  free: string
  locked: string
}

export interface BinanceHolding {
  asset: string           // e.g. "BTC"
  quantity: number        // total (free + locked)
  priceEUR: number        // prix actuel en EUR
  valueEUR: number        // valorisation totale EUR
  avgCostEUR?: number     // prix moyen d'achat en EUR
  pnlEUR?: number         // +/- value en EUR
  pnlPercent?: number     // +/- value en %
  isStablecoin: boolean
}

export interface BinanceSnapshot {
  fetchedAt: string       // ISO timestamp
  holdings: BinanceHolding[]
  totalValueEUR: number
  totalPnlEUR?: number
}

// ─── HMAC Signing ─────────────────────────────────────────────

function sign(queryString: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(queryString)
    .digest('hex')
}

function buildSignedUrl(
  path: string,
  params: Record<string, string | number>,
  secret: string
): string {
  const timestamp = Date.now()
  const qs = new URLSearchParams({
    ...Object.fromEntries(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    ),
    timestamp: String(timestamp),
  }).toString()

  const signature = sign(qs, secret)
  return `${BASE_URL}${path}?${qs}&signature=${signature}`
}

// ─── API fetch helper ─────────────────────────────────────────

async function binanceFetch<T>(
  url: string,
  apiKey: string
): Promise<T> {
  const res = await fetch(url, {
    headers: { 'X-MBX-APIKEY': apiKey },
    // Next.js: revalidate every 60s (live prices)
    next: { revalidate: 60 },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new BinanceError(res.status, body)
  }

  return res.json() as Promise<T>
}

export class BinanceError extends Error {
  constructor(public status: number, public body: string) {
    super(`Binance API error ${status}: ${body}`)
    this.name = 'BinanceError'
  }
}

// ─── Step 1 : Get non-zero spot balances ──────────────────────

async function getSpotBalances(
  apiKey: string,
  secret: string
): Promise<BinanceBalance[]> {
  const url = buildSignedUrl('/api/v3/account', {}, secret)
  const data = await binanceFetch<{ balances: BinanceBalance[] }>(url, apiKey)

  return data.balances.filter((b) => {
    const total = parseFloat(b.free) + parseFloat(b.locked)
    return total > 0
  })
}

// ─── Step 2 : Get live EUR prices ─────────────────────────────

async function getLivePricesEUR(
  assets: string[],
  apiKey: string
): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>()

  // Stablecoins : fetch EURUSDT pour avoir le taux EUR
  let eurUsdRate = 1.08 // fallback
  try {
    const eurRes = await fetch(`${BASE_URL}/api/v3/ticker/price?symbol=EURUSDT`, {
      next: { revalidate: 60 },
    })
    if (eurRes.ok) {
      const d = await eurRes.json()
      // EURUSDT = combien d'USDT pour 1 EUR → inverse pour USD→EUR
      eurUsdRate = parseFloat(d.price)
    }
  } catch {}

  // Build symbols list: e.g. ["BTCEUR", "ETHEUR", ...]
  // Binance doesn't have all XXX/EUR pairs — fallback to XXXUSDT then convert
  const symbols = assets
    .filter((a) => !STABLECOINS.has(a) && a !== 'EUR')
    .flatMap((asset) => [`${asset}EUR`, `${asset}USDT`])

  // Fetch all prices in one call
  const symbolParam = encodeURIComponent(JSON.stringify([...new Set(symbols)]))
  const pricesRes = await fetch(
    `${BASE_URL}/api/v3/ticker/price?symbols=${symbolParam}`,
    { next: { revalidate: 60 } }
  )

  if (pricesRes.ok) {
    const prices: Array<{ symbol: string; price: string }> = await pricesRes.json()

    const eurPairs = new Map(
      prices
        .filter((p) => p.symbol.endsWith('EUR'))
        .map((p) => [p.symbol.replace('EUR', ''), parseFloat(p.price)])
    )

    const usdtPairs = new Map(
      prices
        .filter((p) => p.symbol.endsWith('USDT'))
        .map((p) => [p.symbol.replace('USDT', ''), parseFloat(p.price)])
    )

    for (const asset of assets) {
      if (asset === 'EUR') {
        priceMap.set('EUR', 1)
      } else if (STABLECOINS.has(asset)) {
        // Stablecoins → 1 USD → EUR via EURUSDT rate
        priceMap.set(asset, 1 / eurUsdRate)
      } else if (eurPairs.has(asset)) {
        priceMap.set(asset, eurPairs.get(asset)!)
      } else if (usdtPairs.has(asset)) {
        // Convert via USD→EUR
        priceMap.set(asset, usdtPairs.get(asset)! / eurUsdRate)
      }
    }
  }

  return priceMap
}

// ─── Step 3 : Calculate average cost from trade history ───────

/**
 * Computes the weighted average purchase price for a given asset.
 * Uses the FIFO-approximation: weighted avg of all BUY trades.
 * Note: this is an estimate — does NOT account for withdrawals/deposits.
 *
 * Returns the avg cost in EUR, or undefined if no trade history found.
 */
async function getAvgCostEUR(
  asset: string,
  apiKey: string,
  secret: string,
  priceMap: Map<string, number>
): Promise<number | undefined> {
  if (STABLECOINS.has(asset) || asset === 'EUR') return undefined

  // Try EUR pair first, then USDT pair
  const pairs = [`${asset}EUR`, `${asset}USDT`]
  let eurUsdRate = 1.08

  // Reuse EURUSDT rate from priceMap if available
  const usdcPrice = priceMap.get('USDC')
  if (usdcPrice) eurUsdRate = 1 / usdcPrice

  for (const symbol of pairs) {
    try {
      const url = buildSignedUrl(
        '/api/v3/myTrades',
        { symbol, limit: 500 },
        secret
      )
      const trades = await binanceFetch<Array<{
        isBuyer: boolean
        qty: string
        price: string
        quoteQty: string
        commission: string
        commissionAsset: string
        time: number
      }>>(url, apiKey)

      const buyTrades = trades.filter((t) => t.isBuyer)
      if (buyTrades.length === 0) continue

      // Weighted average: sum(price * qty) / sum(qty)
      let totalQty = 0
      let totalCostNative = 0 // in the quote currency (EUR or USDT)

      for (const trade of buyTrades) {
        const qty = parseFloat(trade.qty)
        const price = parseFloat(trade.price)
        totalQty += qty
        totalCostNative += price * qty
      }

      if (totalQty === 0) continue

      const avgNative = totalCostNative / totalQty

      // Convert to EUR if pair is USDT
      const avgEUR = symbol.endsWith('USDT')
        ? avgNative / eurUsdRate
        : avgNative

      return avgEUR
    } catch {
      // Pair doesn't exist or no trades — try next
      continue
    }
  }

  return undefined
}

// ─── Main export : Full snapshot ──────────────────────────────

/**
 * Fetches a complete Binance snapshot:
 *  1. Spot balances
 *  2. Live EUR prices for all held assets
 *  3. Average cost from trade history (for P&L)
 *
 * @param apiKey  BINANCE_API_KEY env var
 * @param secret  BINANCE_SECRET_KEY env var
 * @param skipPnL Set to true to skip trade history fetch (faster, no P&L)
 */
export async function fetchBinanceSnapshot(
  apiKey: string,
  secret: string,
  skipPnL = false
): Promise<BinanceSnapshot> {
  // 1. Balances
  const rawBalances = await getSpotBalances(apiKey, secret)

  // 2. Live prices
  const assets = rawBalances.map((b) => b.asset)
  const priceMap = await getLivePricesEUR(assets, apiKey)

  // 3. Build holdings (filter dust)
  const holdings: BinanceHolding[] = []

  for (const balance of rawBalances) {
    const qty = parseFloat(balance.free) + parseFloat(balance.locked)
    const priceEUR = priceMap.get(balance.asset) ?? 0
    const valueEUR = qty * priceEUR

    if (valueEUR < MIN_VALUE_EUR) continue // skip dust

    const holding: BinanceHolding = {
      asset: balance.asset,
      quantity: qty,
      priceEUR,
      valueEUR,
      isStablecoin: STABLECOINS.has(balance.asset),
    }

    // 4. P&L from avg cost (skippable)
    if (!skipPnL && !STABLECOINS.has(balance.asset) && balance.asset !== 'EUR') {
      const avgCostEUR = await getAvgCostEUR(balance.asset, apiKey, secret, priceMap)
      if (avgCostEUR !== undefined) {
        holding.avgCostEUR = avgCostEUR
        holding.pnlEUR = (priceEUR - avgCostEUR) * qty
        holding.pnlPercent =
          avgCostEUR > 0 ? ((priceEUR - avgCostEUR) / avgCostEUR) * 100 : undefined
      }
    }

    holdings.push(holding)
  }

  // Sort by value desc
  holdings.sort((a, b) => b.valueEUR - a.valueEUR)

  const totalValueEUR = holdings.reduce((s, h) => s + h.valueEUR, 0)
  const pnlHoldings = holdings.filter((h) => h.pnlEUR !== undefined)
  const totalPnlEUR =
    pnlHoldings.length > 0
      ? pnlHoldings.reduce((s, h) => s + (h.pnlEUR ?? 0), 0)
      : undefined

  return {
    fetchedAt: new Date().toISOString(),
    holdings,
    totalValueEUR,
    totalPnlEUR,
  }
}

// ─── Mapper → Holding[] (pour intégration dans portfolio.json) ──

/**
 * Converts a BinanceSnapshot into the Holding[] format
 * used by the wealth tracker normalizer.
 */
export function binanceSnapshotToHoldings(
  snapshot: BinanceSnapshot
): Array<{
  id: string
  name: string
  ticker: string
  assetClass: 'CRYPTO' | 'CASH'
  geography: ['CRYPTO_GLOBAL']
  quantity: number
  currency: string
  currentPrice: number
  currentValue: number
  unrealizedPnL?: number
  unrealizedPnLPercent?: number
  avgCostEUR?: number
  lastValuationDate: string
}> {
  const date = snapshot.fetchedAt.split('T')[0]

  return snapshot.holdings.map((h) => ({
    id: `crypto-${h.asset.toLowerCase()}`,
    name: h.isStablecoin ? `${h.asset} (stablecoin)` : h.asset,
    ticker: h.asset,
    assetClass: h.isStablecoin ? 'CASH' : 'CRYPTO',
    geography: ['CRYPTO_GLOBAL'],
    quantity: h.quantity,
    currency: h.asset as any,
    currentPrice: h.priceEUR,
    currentValue: h.valueEUR,
    unrealizedPnL: h.pnlEUR,
    unrealizedPnLPercent: h.pnlPercent,
    avgCostEUR: h.avgCostEUR,
    lastValuationDate: date,
  }))
}
