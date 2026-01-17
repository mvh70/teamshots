'use client'

import { useSession } from 'next-auth/react'
import { useSWR, swrFetcher } from '@/lib/swr'
import { normalizePlanTierForUI, isFreePlan, type PlanPeriod, type PlanTier, type UIPlanTier } from '@/domain/subscription/utils'

interface SubscriptionResponse {
  subscription: {
    tier: PlanTier | null
    period?: PlanPeriod
  } | null
}

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
 * Uses SWR for automatic deduplication and caching across components
 */
export function usePlanInfo(): PlanInfo {
  const { data: session } = useSession()
  const userId = session?.user?.id

  const { data, isLoading } = useSWR<SubscriptionResponse>(
    userId ? '/api/user/subscription' : null,
    swrFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      focusThrottleInterval: 5000, // Prevent focus storms
    }
  )

  const tier = data?.subscription?.tier ?? null
  const period = data?.subscription?.period ?? null

  // Compute normalized UI tier and free plan status
  const uiTier = normalizePlanTierForUI(tier, period)
  const freePlan = isFreePlan(period)

  return {
    tier,
    period,
    uiTier,
    isFreePlan: freePlan,
    isLoading: !userId ? false : isLoading
  }
}
