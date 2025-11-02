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
  tier: 'individual' | 'pro' | 'try_once' | null
  period?: 'free' | 'try_once' | 'monthly' | 'annual' | null
}

export default function BillingSection({ 
  userId,
}: BillingSectionProps) {
  const t = useTranslations('app.settings.billing')
  const router = useRouter()
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
  const isFree = currentPeriod === 'free' || !currentTier
  const isTryOnce = currentPeriod === 'try_once' || currentTier === 'try_once'
  const isPro = currentTier === 'pro'

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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <DocumentTextIcon className="h-6 w-6 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">
            {t('title', { default: 'Billing & Invoices' })}
          </h2>
        </div>
      </div>

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

      {isTryOnce && (
        <div className="text-center py-12">
          <div className="max-w-md mx-auto space-y-6">
            <p className="text-base text-gray-700 leading-relaxed">
              {t('tryOnce.message', { default: "🎉 Yay, you bought some photos! Invoices will appear here soon (we're just adding the finishing touches to make them look professional, because that's how we roll)." })}
            </p>
          </div>
        </div>
      )}

      {(currentTier === 'individual' || currentTier === 'pro') && (
        <div className="text-center py-12">
          <div className="max-w-md mx-auto space-y-6">
            <p className="text-base text-gray-700 leading-relaxed">
              {isPro 
                ? t('pro.message', { default: "🎉 Yay, you're a business user and you need these invoices. We know, and we'll give them to you as soon as possible (because organized finances are hot, and we support that energy)." })
                : t('individual.message', { default: "🎉 Yay, you bought some photos! Invoices will appear here soon (we're just adding the finishing touches to make them look professional, because that's how we roll)." })
              }
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

