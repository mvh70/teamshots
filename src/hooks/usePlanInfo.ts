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

      // OPTIMIZATION: Check sessionStorage for initial data first
      try {
        const stored = sessionStorage.getItem('teamshots.initialData')
        if (stored) {
          const initialData = JSON.parse(stored)
          if (initialData.subscription) {
            const subscriptionTier = initialData.subscription.tier ?? null
            const subscriptionPeriod = initialData.subscription.period ?? null
            setTier(subscriptionTier)
            setPeriod(subscriptionPeriod)
            setIsLoading(false)
            // Still fetch fresh data in background if data is stale (>5 seconds)
            const dataAge = Date.now() - (initialData._timestamp || 0)
            if (dataAge > 5000) {
              // Fetch fresh data in background
              jsonFetcher<{ subscription: { tier: PlanTier | null; period?: PlanPeriod } | null }>(
                '/api/user/subscription'
              ).then(data => {
                setTier(data?.subscription?.tier ?? null)
                setPeriod(data?.subscription?.period ?? null)
              }).catch(() => {
                // Ignore errors, keep cached data
              })
            }
            return
          }
        }
      } catch {
        // Ignore parse errors, fall through to fetch
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


