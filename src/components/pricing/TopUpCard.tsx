'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { CheckoutButton } from '@/components/ui'
import { calculatePricePerPhoto, formatPrice, calculatePhotosFromCredits } from '@/domain/pricing'
import { PRICING_CONFIG } from '@/config/pricing'

type Tier = 'individual' | 'vip'

interface TopUpCardProps {
  tier: Tier
  className?: string
  onError?: (message: string) => void
  regenerationsOverride?: number
  returnUrl?: string
}

export default function TopUpCard({ tier, className = '', onError, regenerationsOverride, returnUrl }: TopUpCardProps) {
  const t = useTranslations('pricing')
  const tAll = useTranslations()

  const details = useMemo(() => {
    if (tier === 'vip') {
      return { price: PRICING_CONFIG.vip.topUp.price, credits: PRICING_CONFIG.vip.topUp.credits }
    }
    // Default to individual
    return { price: PRICING_CONFIG.individual.topUp.price, credits: PRICING_CONFIG.individual.topUp.credits }
  }, [tier])

  const displayPricePerPhoto = useMemo(() => {
    const regenerations = typeof regenerationsOverride === 'number'
      ? regenerationsOverride
      : (tier === 'vip'
          ? PRICING_CONFIG.regenerations.vip
          : PRICING_CONFIG.regenerations.individual)
    const ppf = calculatePricePerPhoto(details.price, details.credits, regenerations)
    return { value: formatPrice(ppf), regenerations }
  }, [details, tier, regenerationsOverride])

  return (
    <div className={`relative bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200 flex flex-col h-full ${className}`}>
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-1">
          {tier === 'vip'
            ? t('vipTopUp', { defaultMessage: 'VIP top-up' })
            : t('individualTopUp', { defaultMessage: 'Individual top-up' })}
        </h3>
        <p className="text-gray-600 mb-4">
          {t('topUpSubtitle', { defaultMessage: 'For occasional use' })}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-5xl font-bold text-gray-900">{formatPrice(details.price)}</span>
          <span className="text-gray-600 whitespace-nowrap text-sm leading-none"></span>
        </div>
        <p className="text-sm text-brand-primary font-semibold mt-2">
          {calculatePhotosFromCredits(details.credits)} {t('photos', { defaultMessage: 'photos' })}
        </p>

        <div className="mt-4 relative group">
          <div className="relative overflow-hidden bg-gradient-to-br from-brand-secondary via-brand-secondary to-brand-secondary-hover rounded-2xl p-1 shadow-2xl">
            <div className="bg-white/95 backdrop-blur-sm rounded-xl px-5 py-4">
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-gray-900">{displayPricePerPhoto.value}</span>
                    <span className="text-sm font-semibold text-gray-600">{t('perPhotoVariation', { defaultMessage: 'per photo variation' })}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-600">{t('includesVariationsPerPhoto', { count: displayPricePerPhoto.regenerations, defaultMessage: `Includes ${displayPricePerPhoto.regenerations} variations per photo` })}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature list: for top-ups, only show number of photos (other benefits inherit from plan) */}
      <ul className="space-y-3 mb-8 flex-grow">
        {(() => {
          const regenerations = typeof regenerationsOverride === 'number'
            ? regenerationsOverride
            : (tier === 'vip'
                ? PRICING_CONFIG.regenerations.vip
                : PRICING_CONFIG.regenerations.individual)
          const photos = calculatePhotosFromCredits(details.credits)
          const regenerationText = t('variationsBullet', { count: regenerations })
          return (
            <>
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 text-brand-secondary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700"><strong>{photos}</strong> {t('photoGenerations', { defaultMessage: 'photo generations' })}</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 text-brand-secondary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700">{regenerationText}</span>
              </li>
            </>
          )
        })()}
      </ul>

      <CheckoutButton
        loadingText={tAll('common.loading', { default: 'Loading...' })}
        type="top_up"
        metadata={{ tier, credits: details.credits }}
        returnUrl={returnUrl}
        className="mt-auto"
        onError={onError}
        useBrandCtaColors
      >
        {t('confirmTopUp', { defaultMessage: 'Refill my credits' })}
      </CheckoutButton>
    </div>
  )
}


