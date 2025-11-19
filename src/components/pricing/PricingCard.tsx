'use client'

import { useTranslations } from 'next-intl'
import { calculatePhotosFromCredits } from '@/domain/pricing'
import { comingSoonBadge } from '@/lib/ui/comingSoon'
import { useAnalytics } from '@/hooks/useAnalytics'
import { TrackedLink } from '@/components/TrackedLink'

type PlanId = 'pro' | 'proSmall' | 'proLarge' | 'individual' | 'tryOnce'

interface PricingCardProps {
  id: PlanId
  price: string
  previousPrice?: string
  credits: number
  pricePerPhoto?: string
  regenerations?: number
  popular?: boolean
  popularLabel?: string
  popularLabelKey?: string
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
  previousPrice,
  credits,
  pricePerPhoto,
  regenerations,
  popular,
  popularLabel,
  popularLabelKey,
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
  const displayPrice = price
  const displayPeriod = id === 'tryOnce'
    ? t(`plans.${id}.period`)
    : 'one-time'
  const displayPricePerPhoto = pricePerPhoto

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
    : (id === 'proLarge'
        ? 'ring-2 ring-brand-premium-ring border-2 border-brand-premium-ring'
        : 'border-2 border-brand-primary-lighter')

  return (
    <div className={`relative bg-bg-white rounded-3xl shadow-depth-lg p-8 lg:p-10 ${borderColor} transition-all duration-500 hover:shadow-depth-xl hover:-translate-y-1 flex flex-col h-full overflow-visible ${className || ''}`}>
      {popular && (
        <div className="absolute top-0 right-6 transform -translate-y-1/2">
          <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold bg-brand-cta text-white shadow-depth-lg">
            {popularLabel || (popularLabelKey ? (popularLabelKey.includes('.') ? tAll(popularLabelKey) : t(popularLabelKey)) : t('mostPopular'))}
          </span>
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-2xl lg:text-3xl font-bold text-text-dark mb-3 font-display">{titleOverride || t(`plans.${id}.name`)}</h3>
        <p className="text-base lg:text-lg text-text-body mb-6 leading-relaxed">{descriptionOverride || t(`plans.${id}.description`)}</p>
        <div className="flex items-center gap-2 flex-wrap">
          {previousPrice && (
            <span className="text-2xl font-semibold text-text-muted line-through mr-2">
              {previousPrice}
            </span>
          )}
          <span className="text-5xl font-bold text-text-dark">{displayPrice}</span>
          <span className="text-text-body whitespace-nowrap text-sm leading-none">{displayPeriod}</span>
        </div>
        <p className="text-sm text-brand-primary font-semibold mt-2">
          {calculatePhotosFromCredits(credits)} {calculatePhotosFromCredits(credits) === 1 ? t('photo') : t('photos')}
        </p>

        <div className="mt-6 relative group">
          <div className="relative overflow-hidden bg-gradient-to-br from-brand-secondary via-brand-secondary-hover to-brand-secondary rounded-2xl p-1 shadow-depth-xl">
            <div className="bg-bg-white/95 backdrop-blur-sm rounded-xl px-6 py-5">
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl lg:text-3xl font-black text-text-dark">{displayPricePerPhoto}</span>
                    <span className="text-sm lg:text-base font-semibold text-text-body">{t('perPhotoVariation')}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs lg:text-sm text-text-muted">{t('includesVariationsPerPhoto', { count: regenerations || 0 })}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ul className="space-y-3 lg:space-y-4 mb-8 flex-grow">
        {adjustedFeatures.map((feature) => (
          <li key={feature} className="flex items-start gap-3">
            <svg className="w-5 h-5 lg:w-6 lg:h-6 text-brand-secondary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-base lg:text-lg text-text-body leading-relaxed" dangerouslySetInnerHTML={{ __html: feature }} />
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
              mode: 'link',
            }}
            className={`block w-full text-center px-6 py-4 lg:py-5 rounded-xl font-bold text-base lg:text-lg transition-all duration-300 mt-auto ${
              popular
                ? 'bg-brand-cta text-white hover:bg-brand-cta-hover shadow-depth-lg hover:shadow-depth-xl transform hover:-translate-y-0.5 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-brand-cta focus:ring-offset-2'
                : 'bg-bg-gray-50 text-text-dark hover:bg-brand-primary-light hover:text-brand-primary hover:shadow-depth-md'
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
              mode: 'button',
            })
            onCta()
          }}
          className={`w-full px-6 py-4 lg:py-5 rounded-xl font-bold text-base lg:text-lg transition-all duration-300 mt-auto ${
            popular ? 'bg-brand-cta text-white hover:bg-brand-cta-hover shadow-depth-lg hover:shadow-depth-xl transform hover:-translate-y-0.5 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-brand-cta focus:ring-offset-2' : 'bg-bg-gray-50 text-text-dark hover:bg-brand-primary-light hover:text-brand-primary hover:shadow-depth-md'
          }`}
        >
          {t(`plans.${id}.cta`)}
        </button>
      )}
    </div>
  )
}


