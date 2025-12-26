import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { jsonFetcher } from '@/lib/fetcher'
import { normalizePlanTierForUI, type PlanPeriod } from '@/domain/subscription/utils'

/**
 * Hook to determine the correct "Buy Credits" link based on user's subscription tier.
 * Free users are directed to /app/upgrade, paid users to /app/top-up.
 * 
 * @returns Object with href string and loading state
 */
export function useBuyCreditsLink() {
  const { data: session } = useSession()
  const [href, setHref] = useState<string>('/app/upgrade') // Default to upgrade for safety
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSubscription = async () => {
      if (!session?.user?.id) {
        setHref('/app/upgrade')
        setLoading(false)
        return
      }

      try {
        const data = await jsonFetcher<{ subscription: { tier: string | null; period?: PlanPeriod } | null }>(
          '/api/user/subscription'
        )
        const tierRaw = data?.subscription?.tier ?? null
        const period = data?.subscription?.period ?? null

        // Normalize tier for UI (checks period first to determine free plan)
        const normalized = normalizePlanTierForUI(tierRaw, period)
        
        // Free users go to upgrade, team users go to upgrade (for seats top-up), others go to top-up
        if (normalized === 'free') {
          setHref('/app/upgrade')
        } else if (normalized === 'team') {
          setHref('/app/upgrade')
        } else {
          setHref('/app/top-up')
        }
      } catch (error) {
        console.error('Failed to fetch subscription for buy credits link:', error)
        // Default to upgrade on error (safer than top-up)
        setHref('/app/upgrade')
      } finally {
        setLoading(false)
      }
    }

    fetchSubscription()
  }, [session?.user?.id])

  return { href, loading }
}

