import { NextResponse } from 'next/server'
import {
  fetchBinanceSnapshot,
  binanceSnapshotToHoldings,
  BinanceError,
} from '@/lib/connectors/binance'

/**
 * GET /api/binance
 *
 * Query params:
 *   ?format=raw        → BinanceSnapshot brut
 *   ?format=holdings   → converti en Holding[] (pour patch portfolio)
 *   ?skipPnL=true      → skip trade history (plus rapide, pas de P&L)
 *   (défaut)           → BinanceSnapshot avec P&L
 *
 * Variables d'environnement requises :
 *   BINANCE_API_KEY
 *   BINANCE_SECRET_KEY
 */
export async function GET(request: Request) {
  const apiKey = process.env.BINANCE_API_KEY
  const secret = process.env.BINANCE_SECRET_KEY

  // ── Validation des env vars ───────────────────────────────
  if (!apiKey || !secret) {
    return NextResponse.json(
      {
        error: 'Missing Binance credentials',
        hint: 'Set BINANCE_API_KEY and BINANCE_SECRET_KEY in your .env.local file',
      },
      { status: 500 }
    )
  }

  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') ?? 'raw'
  const skipPnL = searchParams.get('skipPnL') === 'true'

  try {
    const snapshot = await fetchBinanceSnapshot(apiKey, secret, skipPnL)

    if (format === 'holdings') {
      const holdings = binanceSnapshotToHoldings(snapshot)
      return NextResponse.json({
        fetchedAt: snapshot.fetchedAt,
        totalValueEUR: snapshot.totalValueEUR,
        totalPnlEUR: snapshot.totalPnlEUR,
        holdings,
      })
    }

    return NextResponse.json(snapshot)
  } catch (err) {
    if (err instanceof BinanceError) {
      // Binance-specific error (bad key, IP restriction, etc.)
      const body = JSON.parse(err.body).catch?.(() => err.body) ?? err.body
      return NextResponse.json(
        {
          error: 'Binance API error',
          status: err.status,
          detail: body,
          hint: getHint(err.status),
        },
        { status: err.status >= 400 && err.status < 500 ? 400 : 502 }
      )
    }

    console.error('[GET /api/binance]', err)
    return NextResponse.json(
      { error: 'Unexpected error', detail: String(err) },
      { status: 500 }
    )
  }
}

function getHint(status: number): string {
  if (status === 401) return 'Invalid API key — check BINANCE_API_KEY'
  if (status === 403) return 'IP not whitelisted or key missing "Read" permission'
  if (status === 418 || status === 429) return 'Rate limit hit — wait a moment'
  return 'Check your API key permissions on Binance'
}
