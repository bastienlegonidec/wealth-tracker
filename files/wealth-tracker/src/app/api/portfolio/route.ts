import { NextResponse } from 'next/server'
import { getPortfolio } from '@/lib/data'

/**
 * GET /api/portfolio
 * Returns the full normalized portfolio snapshot with computed summary.
 *
 * Query params:
 *   ?view=summary   → only the PortfolioSummary object
 *   ?view=accounts  → only the accounts array (no holdings detail)
 *   (none)          → full snapshot
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const view = searchParams.get('view')

    const portfolio = getPortfolio()

    if (view === 'summary') {
      return NextResponse.json(portfolio.summary)
    }

    if (view === 'accounts') {
      // Strip holdings to keep payload light
      const accounts = portfolio.accounts.map(({ holdings, ...rest }) => rest)
      return NextResponse.json({ accounts, snapshotDate: portfolio.snapshotDate })
    }

    return NextResponse.json(portfolio)
  } catch (error) {
    console.error('[GET /api/portfolio]', error)
    return NextResponse.json(
      { error: 'Failed to load portfolio data' },
      { status: 500 }
    )
  }
}
