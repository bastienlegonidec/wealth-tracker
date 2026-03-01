import { NextResponse } from 'next/server'
import { getAccount, getPortfolio } from '@/lib/data'

/**
 * GET /api/accounts/:id
 * Returns a single account with its full holdings detail.
 *
 * GET /api/accounts/all
 * Returns all accounts (lightweight, no holdings).
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Special route: /api/accounts/all
    if (id === 'all') {
      const portfolio = getPortfolio()
      const accounts = portfolio.accounts.map(({ holdings, ...rest }) => ({
        ...rest,
        holdingsCount: holdings.length,
      }))
      return NextResponse.json(accounts)
    }

    const account = getAccount(id)

    if (!account) {
      return NextResponse.json(
        { error: `Account '${id}' not found` },
        { status: 404 }
      )
    }

    // Compute account-level stats on the fly
    const totalHoldings = account.holdings.length
    const pnlHoldings = account.holdings.filter((h) => h.unrealizedPnL !== undefined)
    const totalPnL = pnlHoldings.reduce((sum, h) => sum + (h.unrealizedPnL ?? 0), 0)

    const enriched = {
      ...account,
      computed: {
        totalHoldings,
        totalPnL,
        topHolding: account.holdings
          .slice()
          .sort((a, b) => b.currentValue - a.currentValue)[0] ?? null,
        bestPerformer: pnlHoldings
          .slice()
          .sort((a, b) => (b.unrealizedPnLPercent ?? 0) - (a.unrealizedPnLPercent ?? 0))[0] ?? null,
        worstPerformer: pnlHoldings
          .slice()
          .sort((a, b) => (a.unrealizedPnLPercent ?? 0) - (b.unrealizedPnLPercent ?? 0))[0] ?? null,
      },
    }

    return NextResponse.json(enriched)
  } catch (error) {
    console.error('[GET /api/accounts/:id]', error)
    return NextResponse.json(
      { error: 'Failed to load account data' },
      { status: 500 }
    )
  }
}
