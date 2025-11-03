import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { jsonFetcher } from '@/lib/fetcher'
import { normalizePlanTierForUI, isFreePlan, type PlanPeriod, type PlanTier, type UIPlanTier } from '@/domain/subscription/utils'

interface PlanInfo {
  tier: PlanTier | null
  period: PlanPeriod | null
  uiTier: UIPlanTier
  isFreePlan: boolean
  isLoading: boolean
}

/**
 * Hook to fetch and normalize user's subscription plan information
 * Returns normalized tier for UI display and free plan status
 * 
 * @returns Plan info including tier, period, UI tier, and free plan status
 */
export function usePlanInfo(): PlanInfo {
  const { data: session } = useSession()
  const [tier, setTier] = useState<PlanTier | null>(null)
  const [period, setPeriod] = useState<PlanPeriod | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchSubscription = async () => {
      if (!session?.user?.id) {
        setIsLoading(false)
        return
      }

      try {
        const data = await jsonFetcher<{ subscription: { tier: PlanTier | null; period?: PlanPeriod } | null }>(
          '/api/user/subscription'
        )
        
        const subscriptionTier = data?.subscription?.tier ?? null
        const subscriptionPeriod = data?.subscription?.period ?? null
        
        setTier(subscriptionTier)
        setPeriod(subscriptionPeriod)
      } catch (error) {
        console.error('Failed to fetch subscription:', error)
        // Default to free on error (safer than assuming paid)
        setTier(null)
        setPeriod(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSubscription()
  }, [session?.user?.id])

  // Compute normalized UI tier and free plan status
  const uiTier = normalizePlanTierForUI(tier, period)
  const freePlan = isFreePlan(period)

  return {
    tier,
    period,
    uiTier,
    isFreePlan: freePlan,
    isLoading
  }
}

