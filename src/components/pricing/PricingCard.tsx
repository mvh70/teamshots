'use client'

import { useTranslations } from 'next-intl'
import { calculatePhotosFromCredits } from '@/domain/pricing'
import { comingSoonBadge } from '@/lib/ui/comingSoon'
import { useAnalytics } from '@/hooks/useAnalytics'
import { TrackedLink } from '@/components/TrackedLink'

type PlanId = 'pro' | 'individual' | 'tryOnce'

interface PricingCardProps {
  id: PlanId
  price: string
  yearlyPrice?: string
  previousPrice?: string
  credits: number
  monthlyPricePerPhoto?: string
  yearlyPricePerPhoto?: string
  pricePerPhoto?: string
  regenerations?: number
  annualSavings?: string
  popular?: boolean
  popularLabel?: string
  popularLabelKey?: string
  isYearly?: boolean
  ctaMode?: 'link' | 'button'
  href?: string
  onCta?: () => void
  ctaSlot?: React.ReactNode
  className?: string
  titleOverride?: string
  descriptionOverride?: string
}

export default function PricingCard({
  id,
  price,
  yearlyPrice,
  previousPrice,
  credits,
  monthlyPricePerPhoto,
  yearlyPricePerPhoto,
  pricePerPhoto,
  regenerations,
  annualSavings,
  popular,
  popularLabel,
  popularLabelKey,
  isYearly = false,
  ctaMode = 'link',
  href,
  onCta,
  ctaSlot,
  className,
  titleOverride,
  descriptionOverride,
}: PricingCardProps) {
  const t = useTranslations('pricing')
  const tAll = useTranslations()
  const { track } = useAnalytics()

  // Match pricing page calculations
  const numberOfPhotos = calculatePhotosFromCredits(credits)
  const displayPrice = isYearly && yearlyPrice
    ? `$${(parseFloat(yearlyPrice.replace('$', '')) / 12).toFixed(2)}`
    : price
  const displayPeriod = id === 'tryOnce'
    ? t(`plans.${id}.period`)
    : (isYearly ? 'billed monthly' : 'monthly')
  const displaySavings = isYearly && annualSavings ? `Save ${annualSavings}/year` : null
  const displayPricePerPhoto = id === 'tryOnce'
    ? pricePerPhoto
    : isYearly
      ? yearlyPricePerPhoto
      : monthlyPricePerPhoto

  const rawFeatures = t.raw(`plans.${id}.features`) as string[]
  const features = rawFeatures.map(feature =>
    feature
      .replace('{regenerations}', (regenerations || 2).toString())
      .replace('{photos}', numberOfPhotos.toString())
  )
  const extras: string[] = []
  if (id !== 'tryOnce') {
    extras.push(`High quality downloads ${comingSoonBadge()}`)
    extras.push(`Style packages ${comingSoonBadge()}`)
  }
  const featuresWithPhotos = [...features, ...extras]
  const adjustedFeatures = id === 'tryOnce'
    ? featuresWithPhotos.map(f => f.toLowerCase().includes('support') ? 'No support' : f)
    : featuresWithPhotos

  const borderColor = popular
    ? 'ring-3 ring-brand-cta-ring border-2 border-brand-cta-ring scale-105 shadow-brand-cta-shadow'
    : (id === 'pro'
        ? 'ring-2 ring-brand-premium-ring border-2 border-brand-premium-ring'
        : 'border-2 border-gray-200')

  return (
    <div className={`relative bg-white rounded-2xl shadow-lg p-8 ${borderColor} transition-all duration-300 hover:shadow-xl flex flex-col h-full ${className || ''}`}>
      {popular && (
        <div className="absolute top-0 right-6 transform -translate-y-1/2">
          <span className="inline-flex items-center px-4 py-1 rounded-full text-sm font-semibold bg-brand-cta text-white shadow-lg">
            {popularLabel || (popularLabelKey ? (popularLabelKey.includes('.') ? tAll(popularLabelKey) : t(popularLabelKey)) : t('mostPopular'))}
          </span>
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">{titleOverride || t(`plans.${id}.name`)}</h3>
        <p className="text-gray-600 mb-4">{descriptionOverride || t(`plans.${id}.description`)}</p>
        <div className="flex items-center gap-2">
          {previousPrice && (
            <span className="text-2xl font-semibold text-gray-500 line-through mr-2">
              {previousPrice}
            </span>
          )}
          <span className="text-5xl font-bold text-gray-900">{displayPrice}</span>
          <span className="text-gray-600 whitespace-nowrap text-sm leading-none">{displayPeriod}</span>
          {displaySavings && (
            <span className="ml-3 relative inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg">
              {displaySavings}
            </span>
          )}
        </div>
        <p className="text-sm text-brand-primary font-semibold mt-2">
          {credits} {id === 'tryOnce' ? t('credits') : t('creditsPerMonth')}
        </p>

        <div className="mt-4 relative group">
          <div className="relative overflow-hidden bg-gradient-to-br from-emerald-400 via-green-500 to-teal-600 rounded-2xl p-1 shadow-2xl">
            <div className="bg-white/95 backdrop-blur-sm rounded-xl px-5 py-4">
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-gray-900">{displayPricePerPhoto}</span>
                    <span className="text-sm font-semibold text-gray-600">{t('perPhotoVariation')}</span>
                  </div>
                                      <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-600">{t('includesVariationsPerPhoto', { count: regenerations || 0 })}</span>
                    </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ul className="space-y-3 mb-8 flex-grow">
        {adjustedFeatures.map((feature) => (
          <li key={feature} className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-gray-700" dangerouslySetInnerHTML={{ __html: feature }} />
          </li>
        ))}
      </ul>

      {ctaSlot ? (
        <div className="mt-auto">{ctaSlot}</div>
      ) : (
        ctaMode === 'link' &&
        href && (
          <TrackedLink
            href={href}
            event="cta_clicked"
            eventProperties={{
              placement: 'pricing_card',
              plan: id,
              billing: isYearly ? 'annual' : 'monthly',
              mode: 'link',
            }}
            className={`block w-full text-center px-6 py-3 rounded-lg font-semibold transition-all duration-300 mt-auto ${
              popular
                ? 'bg-brand-cta text-white hover:bg-brand-cta-hover shadow-lg'
                : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
            }`}
          >
            {t(`plans.${id}.cta`)}
          </TrackedLink>
        )
      )}

      {!ctaSlot && ctaMode === 'button' && onCta && (
        <button
          type="button"
          onClick={() => {
            track('cta_clicked', {
              placement: 'pricing_card',
              plan: id,
              billing: isYearly ? 'annual' : 'monthly',
              mode: 'button',
            })
            onCta()
          }}
          className={`w-full px-6 py-3 rounded-lg font-semibold transition-all duration-300 mt-auto ${
            popular ? 'bg-brand-cta text-white hover:bg-brand-cta-hover shadow-lg' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
          }`}
        >
          {t(`plans.${id}.cta`)}
        </button>
      )}
    </div>
  )
}


