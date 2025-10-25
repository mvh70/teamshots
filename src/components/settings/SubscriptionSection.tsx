'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { PRICING_CONFIG } from '@/config/pricing'
import { formatTierName, getTierFeatures, SubscriptionTier } from '@/lib/subscription-utils'
import { CreditCardIcon, CheckIcon, ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline'

interface SubscriptionSectionProps {
  userId: string
}

interface Subscription {
  status: string
  tier: SubscriptionTier
}

// Helper to normalize tier names for formatTierName function
const formatSubscriptionTier = (tier: unknown): 'individual' | 'pro' | null => {
  if (tier === 'individual' || tier === 'pro') return tier
  return null
}

export default function SubscriptionSection({ userId }: SubscriptionSectionProps) {
  const t = useTranslations('app.settings.subscription')
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [features, setFeatures] = useState<{ credits: number; regenerations: number } | null>(null)

  useEffect(() => {
    loadSubscription()
  }, [userId])

  const loadSubscription = async () => {
    try {
      const response = await fetch('/api/user/subscription')
      if (response.ok) {
        const data = await response.json()
        setSubscription(data.subscription)
      } else {
        console.error('Failed to load subscription:', response.statusText)
      }
    } catch (error) {
      console.error('Failed to load subscription:', error)
    } finally {
      setLoading(false)
    }
  }

  const isActive = subscription?.status === 'active'
  const currentTier = subscription?.tier
  const displayTier = formatSubscriptionTier(currentTier)

  useEffect(() => {
    if (displayTier) {
      getTierFeatures(displayTier).then(setFeatures)
    }
  }, [displayTier])

  const handlePurchase = async (type: string, priceId?: string) => {
    console.log('🛒 Starting purchase process:', { type, priceId })
    setProcessing(true)
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, priceId }),
      })

      console.log('📡 Checkout API response:', response.status, response.statusText)
      const data = await response.json()
      console.log('📄 Response data:', data)
      
      if (data.checkoutUrl) {
        console.log('✅ Redirecting to checkout:', data.checkoutUrl)
        window.location.href = data.checkoutUrl
      } else if (data.error) {
        console.error('❌ Checkout error:', data.error)
        alert(`Failed to create checkout: ${data.error}`)
      } else {
        console.error('❌ Unexpected response format:', data)
        alert('Unexpected response from server. Please try again.')
      }
    } catch (error) {
      console.error('❌ Failed to create checkout:', error)
      alert('Failed to create checkout. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  const handleUpgrade = async (newTier: 'individual' | 'pro') => {
    setProcessing(true)
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
    } finally {
      setProcessing(false)
    }
  }

  const handleDowngrade = async (newTier: 'individual' | 'pro') => {
    const confirmed = confirm(
      `Are you sure you want to downgrade to the ${formatTierName(formatSubscriptionTier(newTier))} plan? ` +
      `Your current plan will remain active until the end of the billing period, ` +
      `then switch to the new plan.`
    )
    
    if (!confirmed) return

    setProcessing(true)
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
    } finally {
      setProcessing(false)
    }
  }

  const handleCancel = async () => {
    const confirmed = confirm(
      'Are you sure you want to cancel your subscription? ' +
      'You will lose access to your subscription benefits immediately. ' +
      'This action cannot be undone.'
    )
    
    if (!confirmed) {
      return
    }

    setProcessing(true)
    try {
      const response = await fetch('/api/stripe/subscription', {
        method: 'DELETE',
      })

      if (response.ok) {
        await loadSubscription()
        alert('Subscription cancelled successfully')
        window.location.reload()
      } else {
        const error = await response.json()
        alert(`Failed to cancel subscription: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to cancel subscription:', error)
      alert('Failed to cancel subscription')
    } finally {
      setProcessing(false)
    }
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

      {currentTier && isActive ? (
        <div className="space-y-4">
          {/* Current Subscription */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-medium text-blue-900">
                  {currentTier === 'try_once' ? 'Try Once' : displayTier ? formatTierName(displayTier) : currentTier} - Active
                </h3>
                <p className="text-sm text-blue-700">
                  {currentTier === 'try_once' ? 'One-time purchase' : (features ? `${features.credits} credits per month` : 'Loading...')}
                </p>
              </div>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                <CheckIcon className="h-4 w-4 mr-1" />
                Active
              </span>
            </div>

            {/* Cancel Button - Only show for active subscriptions, not Try Once */}
            {currentTier !== 'try_once' && (
              <button
                onClick={handleCancel}
                disabled={processing}
                className="mt-3 w-full px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                Cancel Subscription
              </button>
            )}
          </div>

          {/* Upgrade/Downgrade Options */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">
              Change Plan
            </h4>
            <div className="space-y-3">
              {currentTier === 'try_once' && (
                <>
                  {/* Upgrade to Individual */}
                  <button
                    onClick={() => {
                      console.log('🖱️ Individual button clicked')
                      handlePurchase('subscription', PRICING_CONFIG.individual.monthly.stripePriceId)
                    }}
                    disabled={processing}
                    className="w-full text-left p-3 border border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <ArrowUpIcon className="h-4 w-4 text-green-600" />
                          <p className="font-medium text-gray-900">Upgrade to Individual</p>
                        </div>
                        <p className="text-sm text-gray-600">
                          ${PRICING_CONFIG.individual.monthly.price}/month - {PRICING_CONFIG.individual.includedCredits} credits
                        </p>
                      </div>
                      <span className="text-sm text-green-600 font-medium">Subscribe</span>
                    </div>
                  </button>

                  {/* Upgrade to Pro */}
                  <button
                    onClick={() => {
                      console.log('🖱️ Pro button clicked')
                      handlePurchase('subscription', PRICING_CONFIG.pro.monthly.stripePriceId)
                    }}
                    disabled={processing}
                    className="w-full text-left p-3 border-2 border-gray-300 rounded-lg hover:border-brand-primary hover:bg-brand-primary/5 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <ArrowUpIcon className="h-4 w-4 text-brand-primary" />
                          <p className="font-medium text-gray-900">Upgrade to Pro</p>
                          <span className="text-xs bg-brand-primary text-white px-2 py-0.5 rounded">Popular</span>
                        </div>
                        <p className="text-sm text-gray-600">
                          ${PRICING_CONFIG.pro.monthly.price}/month - {PRICING_CONFIG.pro.includedCredits} credits
                        </p>
                      </div>
                      <span className="text-sm text-brand-primary font-medium">Subscribe</span>
                    </div>
                  </button>
                </>
              )}

              {currentTier === 'individual' && (
                <>
                  {/* Upgrade to Pro */}
                  <button
                    onClick={() => handleUpgrade('pro')}
                    disabled={processing}
                    className="w-full text-left p-3 border-2 border-gray-300 rounded-lg hover:border-brand-primary hover:bg-brand-primary/5 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <ArrowUpIcon className="h-4 w-4 text-brand-primary" />
                          <p className="font-medium text-gray-900">Upgrade to Pro</p>
                          <span className="text-xs bg-brand-primary text-white px-2 py-0.5 rounded">Popular</span>
                        </div>
                        <p className="text-sm text-gray-600">
                          ${PRICING_CONFIG.pro.monthly.price}/month - {PRICING_CONFIG.pro.includedCredits} credits
                        </p>
                      </div>
                      <span className="text-sm text-brand-primary font-medium">Upgrade</span>
                    </div>
                  </button>
                </>
              )}

              {currentTier === 'pro' && (
                <>
                  {/* Downgrade to Individual */}
                  <button
                    onClick={() => handleDowngrade('individual')}
                    disabled={processing}
                    className="w-full text-left p-3 border border-gray-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <ArrowDownIcon className="h-4 w-4 text-orange-600" />
                          <p className="font-medium text-gray-900">Downgrade to Individual</p>
                        </div>
                        <p className="text-sm text-gray-600">
                          ${PRICING_CONFIG.individual.monthly.price}/month - {PRICING_CONFIG.individual.includedCredits} credits
                        </p>
                        <p className="text-xs text-orange-600 mt-1">
                          Your Pro plan remains active until the end of billing period
                        </p>
                      </div>
                      <span className="text-sm text-orange-600 font-medium">Downgrade</span>
                    </div>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-gray-600">
            {t('noSubscription', { default: 'You don\'t have an active subscription' })}
          </p>

          {/* Try Once */}
          <button
            onClick={() => handlePurchase('try_once', PRICING_CONFIG.tryOnce.stripePriceId)}
            disabled={processing}
            className="w-full text-left p-4 border-2 border-gray-300 rounded-lg hover:border-brand-primary transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Try Once</p>
                <p className="text-sm text-gray-600">
                  ${PRICING_CONFIG.tryOnce.price} - {PRICING_CONFIG.tryOnce.credits} credits
                </p>
              </div>
              <span className="px-4 py-2 bg-gray-100 rounded-md text-sm font-medium">
                Buy Now
              </span>
            </div>
          </button>

          {/* Subscription Plans */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {/* Individual Plan */}
            <div className="border-2 border-gray-300 rounded-lg p-4 hover:border-brand-primary transition-colors">
              <h3 className="font-semibold text-gray-900 mb-1">Individual</h3>
              <p className="text-2xl font-bold text-gray-900 mb-1">
                ${PRICING_CONFIG.individual.monthly.price}
                <span className="text-sm font-normal text-gray-600">/month</span>
              </p>
              <p className="text-sm text-gray-600 mb-3">
                {PRICING_CONFIG.individual.includedCredits} credits per month
              </p>
              <button
                onClick={() => handlePurchase('subscription', PRICING_CONFIG.individual.monthly.stripePriceId)}
                disabled={processing}
                className="w-full px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary-hover text-sm font-medium"
              >
                Subscribe
              </button>
            </div>

            {/* Pro Plan */}
            <div className="border-2 border-brand-primary rounded-lg p-4 relative">
              <span className="absolute top-0 right-0 bg-brand-primary text-white px-3 py-1 text-xs font-medium rounded-bl-lg rounded-tr-lg">
                Popular
              </span>
              <h3 className="font-semibold text-gray-900 mb-1">Pro</h3>
              <p className="text-2xl font-bold text-gray-900 mb-1">
                ${PRICING_CONFIG.pro.monthly.price}
                <span className="text-sm font-normal text-gray-600">/month</span>
              </p>
              <p className="text-sm text-gray-600 mb-3">
                {PRICING_CONFIG.pro.includedCredits} credits per month
              </p>
              <button
                onClick={() => handlePurchase('subscription', PRICING_CONFIG.pro.monthly.stripePriceId)}
                disabled={processing}
                className="w-full px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary-hover text-sm font-medium"
              >
                Subscribe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
