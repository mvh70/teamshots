'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { DocumentTextIcon } from '@heroicons/react/24/outline'
import { jsonFetcher } from '@/lib/fetcher'
import { useRouter } from '@/i18n/routing'
import { BRAND_CONFIG } from '@/config/brand'

interface BillingSectionProps {
  userId: string
}

interface Subscription {
  status: string
  tier: 'individual' | 'pro' | null
  period?: 'free' | 'monthly' | 'annual' | null
}

export default function BillingSection({ 
  userId,
}: BillingSectionProps) {
  const t = useTranslations('app.settings.billing')
  const router = useRouter()
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
  const currentPeriod = subscription?.period || null
  const isFree = currentPeriod === 'free' || !currentTier
  const isPaid = !isFree && (currentTier === 'individual' || currentTier === 'pro')

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
        {t('title', { default: 'Billing & Invoices' })}
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        {t('subtitle', { default: 'View and download your invoices' })}
      </p>

      {isFree && (
        <div className="text-center py-12">
          <div className="max-w-md mx-auto space-y-6">
            <p className="text-base text-gray-700 leading-relaxed">
              {t('free.message', { default: "🎉 Hey there! You haven't bought anything yet, so this screen is empty. No invoices, no bills, no surprises (except the good kind when you see our photos!)" })}
            </p>
            <button
              onClick={() => router.push('/app/upgrade')}
              className="px-6 py-3 text-white rounded-md font-medium"
              style={{ backgroundColor: BRAND_CONFIG.colors.cta }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = BRAND_CONFIG.colors.ctaHover }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = BRAND_CONFIG.colors.cta }}
            >
              {t('free.button', { default: 'Fill this screen with greatness! 🚀' })}
            </button>
          </div>
        </div>
      )}

      {isPaid && (
        <div className="text-center py-12">
          <div className="max-w-md mx-auto space-y-6">
            <p className="text-base text-gray-700 leading-relaxed">
              {t('paid.message', { default: "🎉 Yay, we know that as a business you need these invoices. We'll give them to you as soon as possible (because organized finances are hot, and we support that energy)." })}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

