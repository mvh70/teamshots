import { useCallback } from 'react'
import { isRecord } from '@/lib/type-guards'
import { useSWR } from '@/lib/swr'

interface UseInviteStatsOptions<TStats> {
  initialStats: TStats
  enabled?: boolean
}

export function useInviteStats<TStats extends object>(
  token: string,
  options: UseInviteStatsOptions<TStats>
) {
  const { initialStats, enabled = true } = options
  const key = enabled && token ? `/api/team/member/stats?token=${encodeURIComponent(token)}` : null

  const { data, error, isLoading, mutate } = useSWR<Record<string, unknown>>(
    key,
    async (url: string) => {
      const response = await fetch(url, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error(`Stats request failed (${response.status})`)
      }
      return response.json() as Promise<Record<string, unknown>>
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  )

  const stats = isRecord(data) && isRecord(data.stats)
    ? (data.stats as unknown as TStats)
    : initialStats

  const refreshStats = useCallback(async () => {
    if (!key) return

    await mutate()
  }, [key, mutate])

  return {
    stats,
    loading: enabled ? isLoading : false,
    error: error instanceof Error ? error.message : null,
    refreshStats,
  }
}
