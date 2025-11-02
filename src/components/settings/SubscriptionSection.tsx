'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { formatTierName } from '@/domain/subscription/utils'
import { CreditCardIcon } from '@heroicons/react/24/outline'
import { jsonFetcher } from '@/lib/fetcher'
import SubscriptionPanel from '@/components/subscription/SubscriptionPanel'

interface SubscriptionSectionProps {
  userId: string
  userMode?: 'individual' | 'team'
}

interface Subscription {
  status: string
  tier: 'individual' | 'pro' | 'try_once' | null
  period?: 'free' | 'try_once' | 'monthly' | 'annual' | null
  nextRenewal?: string | null
  nextChange?: {
    action: 'start' | 'change' | 'cancel' | 'schedule'
    planTier: 'individual' | 'pro'
    planPeriod: 'monthly' | 'annual'
    effectiveDate: string
  } | null
}

// Helper to normalize tier names for formatTierName function
const formatSubscriptionTier = (tier: unknown): 'individual' | 'pro' | null => {
  if (tier === 'individual' || tier === 'pro') return tier
  return null
}

export default function SubscriptionSection({ 
  userId,
  userMode = 'individual',
}: SubscriptionSectionProps) {
  const t = useTranslations('app.settings.subscription')
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  

  useEffect(() => {
    loadSubscription()
  }, [userId])

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
  const currentPeriod = subscription?.period || null

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
      `Are you sure you want to downgrade to the ${formatTierName(formatSubscriptionTier(newTier))} plan? ` +
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
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <CreditCardIcon className="h-6 w-6 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">
            {t('title', { default: 'Subscription' })}
          </h2>
        </div>
      </div>

      <SubscriptionPanel
        subscription={{ status: subscription?.status || null, tier: formatSubscriptionTier(currentTier) || null, period: currentPeriod, nextRenewal: subscription?.nextRenewal ?? null, nextChange: subscription?.nextChange ?? null }}
        userMode={userMode === 'team' ? 'team' : 'user'}
        onCancel={handleCancel}
        onUpgrade={(to) => handleUpgrade(to)}
        onDowngrade={(to) => handleDowngrade(to)}
        onCheckoutError={handleCheckoutError}
      />
    </div>
  )
}
