'use client'

import { useState, useEffect, useCallback } from 'react'
import type { BinanceSnapshot } from '@/lib/connectors/binance'

type Status = 'idle' | 'loading' | 'success' | 'error'

interface UseBinanceReturn {
  snapshot: BinanceSnapshot | null
  status: Status
  error: string | null
  lastFetchedAt: string | null
  refetch: () => void
}

/**
 * Fetches live Binance data from /api/binance.
 * Auto-refreshes every `refreshInterval` ms (default 60s).
 *
 * Usage:
 *   const { snapshot, status, refetch } = useBinance()
 */
export function useBinance(
  options: {
    skipPnL?: boolean
    refreshInterval?: number // ms, 0 = no auto-refresh
    enabled?: boolean
  } = {}
): UseBinanceReturn {
  const {
    skipPnL = false,
    refreshInterval = 60_000,
    enabled = true,
  } = options

  const [snapshot, setSnapshot] = useState<BinanceSnapshot | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    if (!enabled) return

    setStatus('loading')
    setError(null)

    try {
      const params = new URLSearchParams({ format: 'raw' })
      if (skipPnL) params.set('skipPnL', 'true')

      const res = await fetch(`/api/binance?${params}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.detail ?? data.error ?? `HTTP ${res.status}`)
      }

      setSnapshot(data as BinanceSnapshot)
      setLastFetchedAt(new Date().toISOString())
      setStatus('success')
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
      setStatus('error')
    }
  }, [enabled, skipPnL])

  // Initial fetch
  useEffect(() => {
    fetch_()
  }, [fetch_])

  // Auto-refresh
  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0) return
    const id = setInterval(fetch_, refreshInterval)
    return () => clearInterval(id)
  }, [fetch_, refreshInterval])

  return { snapshot, status, error, lastFetchedAt, refetch: fetch_ }
}
