'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { formatTierName, PlanPeriod, PlanTier } from '@/domain/subscription/utils'
import { jsonFetcher } from '@/lib/fetcher'
import SubscriptionPanel from '@/components/subscription/SubscriptionPanel'

interface SubscriptionSectionProps {
  userId: string
  userMode?: 'individual' | 'team'
}

interface Subscription {
  status: string
  tier: PlanTier
  period: PlanPeriod
  nextRenewal?: string | null
  nextChange?: {
    action: 'start' | 'change' | 'cancel' | 'schedule'
    planTier: PlanTier
    planPeriod: PlanPeriod
    effectiveDate: string
  } | null
}

// Helper to normalize tier names for formatTierName function
const formatSubscriptionTier = (tier: unknown): PlanTier => {
  if (tier === 'individual' || tier === 'pro') return tier
  return 'individual' // Default fallback
}

// Helper to normalize period from API format to PlanPeriod type
const normalizePeriod = (period: unknown): PlanPeriod => {
  // Valid PlanPeriod values
  if (period === 'free' || period === 'small' || period === 'large') {
    return period as PlanPeriod
  }
  // Legacy periods map to free (tryOnce/try_once are free plans)
  if (period === 'try_once' || period === 'tryOnce') return 'free'
  // Legacy subscription periods map to small/large as best effort, or free
  if (period === 'monthly') return 'small'
  if (period === 'annual') return 'large'
  
  // Default fallback
  return 'free'
}

// Helper to normalize planPeriod for nextChange (must exclude null)
// Returns 'free' | 'small' | 'large' | 'seats' (valid PlanPeriod values)
const normalizeNextChangePeriod = (period: unknown): PlanPeriod => {
  // Valid PlanPeriod values (already correct)
  if (period === 'free' || period === 'small' || period === 'large' || period === 'seats') {
    return period as PlanPeriod
  }
  // Map UIPlanTier values to PlanPeriod values
  if (period === 'vip') return 'large'
  if (period === 'individual') return 'small'
  // Legacy periods: map monthly/annual to small/large
  // This is a best-effort mapping since transactional pricing doesn't have monthly/annual
  if (period === 'annual') return 'large'
  if (period === 'monthly') return 'small'
  // Legacy tryOnce/try_once periods map to free
  if (period === 'try_once' || period === 'tryOnce') return 'free'
  // Default fallback to small
  return 'small'
}

export default function SubscriptionSection({ 
  userId,
  userMode = 'individual',
}: SubscriptionSectionProps) {
  const t = useTranslations('app.settings.subscription')
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  

  // Fetch subscription when userId changes - intentional data fetching on prop change
  /* eslint-disable react-you-might-not-need-an-effect/no-adjust-state-on-prop-change */
  useEffect(() => {
    loadSubscription()
  }, [userId])
  /* eslint-enable react-you-might-not-need-an-effect/no-adjust-state-on-prop-change */

  const loadSubscription = async () => {
    try {
      const data = await jsonFetcher<{ subscription: Subscription }>('/api/user/subscription')
      setSubscription(data.subscription)
    } catch (error) {
      console.error('Failed to load subscription:', error)
    } finally {
      setLoading(false)
    }
  }

  const currentTier = subscription?.tier
  const currentPeriod = normalizePeriod(subscription?.period)

  const handleCheckoutError = (message: string) => {
    alert(`Failed to create checkout: ${message}`)
  }

  const handleUpgrade = async (newTier: 'individual' | 'pro') => {
    try {
      const response = await fetch('/api/stripe/subscription', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newTier }),
      })

      if (response.ok) {
        await loadSubscription()
        alert('Subscription upgraded successfully!')
        window.location.reload()
      } else {
        const error = await response.json()
        alert(`Failed to upgrade: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to upgrade subscription:', error)
      alert('Failed to upgrade subscription')
    } finally {}
  }

  const handleDowngrade = async (newTier: 'individual' | 'pro') => {
    const confirmed = confirm(
      `Are you sure you want to downgrade to the ${t(formatTierName(formatSubscriptionTier(newTier)))} plan? ` +
      `Your current plan will remain active until the end of the billing period, ` +
      `then switch to the new plan.`
    )
    
    if (!confirmed) return

    try {
      const response = await fetch('/api/stripe/subscription', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newTier }),
      })

      if (response.ok) {
        await loadSubscription()
        alert('Subscription downgraded successfully!')
        window.location.reload()
      } else {
        const error = await response.json()
        alert(`Failed to downgrade: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to downgrade subscription:', error)
      alert('Failed to downgrade subscription')
    } finally {}
  }

  const handleCancel = async () => {
    const confirmed = confirm(
      t('cancelConfirm', {
        default: 'Are you sure you want to cancel your subscription? Your benefits remain active until the end of the current billing period. After the last subscription day, your photos will be retained for 30 days.'
      })
    )
    
    if (!confirmed) {
      return
    }

    try {
      const response = await fetch('/api/stripe/subscription', {
        method: 'DELETE',
      })

      if (response.ok) {
        const data = await response.json()
        const effectiveDate = data?.effectiveDate 
          ? new Date(data.effectiveDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
          : 'period end'
        alert(`Subscription cancellation scheduled. Your benefits remain active until ${effectiveDate}.`)
        window.location.reload()
      } else {
        const error = await response.json()
        alert(`Failed to cancel subscription: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to cancel subscription:', error)
      alert('Failed to cancel subscription')
    } finally {}
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        {t('title', { default: 'Pricing plan' })}
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        {t('subtitle', { default: 'Manage your subscription and pricing plan' })}
      </p>

      <SubscriptionPanel
        subscription={{
          status: subscription?.status || null,
          tier: formatSubscriptionTier(currentTier),
          period: currentPeriod,
          nextRenewal: subscription?.nextRenewal ?? null,
          nextChange: subscription?.nextChange ? {
            ...subscription.nextChange,
            planPeriod: normalizeNextChangePeriod(subscription.nextChange.planPeriod)
          } : null
        }}
        userMode={userMode === 'team' ? 'team' : 'user'}
        onCancel={handleCancel}
        onUpgrade={(to) => handleUpgrade(to)}
        onDowngrade={(to) => handleDowngrade(to)}
        onCheckoutError={handleCheckoutError}
      />
    </div>
  )
}
