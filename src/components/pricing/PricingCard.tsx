'use client'

import { useTranslations } from 'next-intl'
import { calculatePhotosFromCredits } from '@/domain/pricing'
import { comingSoonBadge } from '@/lib/ui/comingSoon'
import { useAnalytics } from '@/hooks/useAnalytics'
import { TrackedLink } from '@/components/TrackedLink'

type PlanId = 'pro' | 'proSmall' | 'proLarge' | 'individual' | 'tryItForFree'

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
  const displayPeriod = id === 'tryItForFree'
    ? t(`plans.${id}.period`)
    : 'one-time'
  const displayPricePerPhoto = pricePerPhoto

  const rawFeatures = t.raw(`plans.${id}.features`) as string[]
  const totalShots = (regenerations || 2) + 1 // Original + regenerations
  const features = rawFeatures.map(feature =>
    feature
      .replace('{regenerations}', (regenerations || 2).toString())
      .replace('{shots}', totalShots.toString())
      .replace('{photos}', numberOfPhotos.toString())
  )
  const extras: string[] = []
  if (id !== 'tryItForFree') {
    extras.push(`High quality downloads ${comingSoonBadge()}`)
    extras.push(`Style packages ${comingSoonBadge()}`)
  }
  const featuresWithPhotos = [...features, ...extras]
  const adjustedFeatures = id === 'tryItForFree'
    ? featuresWithPhotos.map(f => f.toLowerCase().includes('support') ? 'No support' : f)
    : featuresWithPhotos

  const isFree = id === 'tryItForFree'
  const borderColor = popular
    ? 'ring-4 ring-brand-cta-ring/40 border-[3px] border-brand-cta-ring scale-105 shadow-depth-2xl shadow-brand-cta-shadow/60'
    : isFree
      ? 'ring-2 ring-brand-secondary/30 border-2 border-brand-secondary/40'
      : (id === 'proLarge'
          ? 'ring-2 ring-brand-premium-ring/40 border-2 border-brand-premium-ring'
          : 'border-2 border-brand-primary-lighter/60')

  return (
    <div className={`relative bg-bg-white rounded-3xl shadow-depth-xl p-6 sm:p-8 lg:p-10 xl:p-12 ${borderColor} transition-all duration-500 hover:shadow-depth-2xl hover:-translate-y-2 flex flex-col min-h-[650px] overflow-visible ${className || ''} ${isFree ? 'bg-gradient-to-br from-bg-white via-bg-white to-brand-secondary-light/40' : ''} ${popular ? 'lg:mt-[-24px] lg:mb-[24px] z-10' : ''}`}>
      {isFree && (
        <div className="absolute -top-4 right-4 z-10">
          <span className="inline-flex items-center px-5 py-2 rounded-full text-xs font-bold bg-gradient-to-r from-brand-secondary to-brand-secondary-hover text-white shadow-depth-lg ring-2 ring-white">
            FREE
          </span>
        </div>
      )}
      {!isFree && (
        <div className="absolute -top-4 right-4 z-10">
          <span className="inline-flex items-center px-5 py-2 rounded-full text-xs font-bold bg-gradient-to-r from-brand-secondary to-brand-secondary-hover text-white shadow-depth-lg ring-2 ring-white">
            NO SUBSCRIPTION
          </span>
        </div>
      )}

      <div className="mb-8">
        <h3 className={`text-2xl lg:text-3xl xl:text-4xl font-bold mb-5 font-display leading-tight ${isFree ? 'text-brand-secondary' : 'text-text-dark'}`}>
          {titleOverride || t(`plans.${id}.name`)}
        </h3>
        <p className="text-base lg:text-lg text-text-body mb-8 leading-relaxed">{descriptionOverride || t(`plans.${id}.description`)}</p>
        <div className="mb-5">
          {previousPrice && (
            <span className="text-2xl lg:text-3xl font-semibold text-text-muted line-through mb-2 block">
              {previousPrice}
            </span>
          )}
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col">
              <span className={`text-5xl lg:text-6xl xl:text-7xl font-black leading-none ${isFree ? 'bg-gradient-to-r from-brand-secondary to-brand-secondary-hover bg-clip-text text-transparent' : 'text-text-dark'}`}>
                {displayPrice}
              </span>
              {!isFree && (
                <>
                  <span className="text-lg lg:text-xl font-bold text-brand-secondary mt-1">
                    ONE-TIME PAYMENT
                  </span>
                  <span className="text-sm text-text-muted mt-0.5">
                    No subscription required
                  </span>
                </>
              )}
            </div>
            {popular && (
              <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-brand-cta to-brand-cta-hover text-white shadow-depth-md shrink-0 mt-2">
                {popularLabel || (popularLabelKey ? (popularLabelKey.includes('.') ? tAll(popularLabelKey) : t(popularLabelKey)) : t('mostPopular'))}
              </span>
            )}
          </div>
        </div>
        <div className={`inline-flex items-center px-5 py-2.5 rounded-xl font-bold text-sm lg:text-base mb-6 ${isFree ? 'bg-brand-secondary-light text-brand-secondary' : 'bg-brand-primary-light text-brand-primary'}`}>
          {calculatePhotosFromCredits(credits)} {calculatePhotosFromCredits(credits) === 1 ? t('photo') : t('photos')}
        </div>

        {!isFree && displayPricePerPhoto && (
          <div className="relative group mb-2">
            <div className="relative overflow-hidden bg-gradient-to-br from-brand-secondary via-brand-secondary-hover to-brand-secondary rounded-2xl p-2.5 shadow-depth-xl">
              <div className="bg-bg-white rounded-xl px-6 py-5">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-3xl lg:text-4xl xl:text-5xl font-black text-text-dark">{displayPricePerPhoto}</span>
                  <span className="text-sm lg:text-base font-bold text-text-body">{t('perPhotoVariation')}</span>
                  <span className="text-xs lg:text-sm text-text-muted font-semibold">({t('includesVariationsPerPhoto', { count: regenerations || 0 })})</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <ul className="space-y-4 lg:space-y-5 mb-10 flex-grow">
        {adjustedFeatures.map((feature) => (
          <li key={feature} className="flex items-start gap-4 group/item">
            <div className={`flex-shrink-0 mt-1 w-7 h-7 lg:w-8 lg:h-8 rounded-full flex items-center justify-center shadow-sm ${isFree ? 'bg-brand-secondary-light' : 'bg-brand-secondary-light'} group-hover/item:scale-110 group-hover/item:shadow-md transition-all duration-200`}>
              <svg className={`w-4 h-4 lg:w-5 lg:h-5 ${isFree ? 'text-brand-secondary' : 'text-brand-secondary'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-base lg:text-lg text-text-body leading-relaxed font-medium pt-1" dangerouslySetInnerHTML={{ __html: feature }} />
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
            className={`block w-full text-center px-8 py-5 lg:py-6 rounded-2xl font-bold text-base lg:text-lg transition-all duration-300 mt-auto ${
              isFree
                ? 'bg-gradient-to-r from-brand-secondary to-brand-secondary-hover text-white shadow-depth-xl hover:shadow-depth-2xl hover:shadow-brand-secondary/30 transform hover:-translate-y-1.5 hover:scale-[1.03] active:scale-[0.97] focus:outline-none focus:ring-4 focus:ring-brand-secondary focus:ring-offset-2 ring-offset-bg-white'
                : popular
                  ? 'bg-gradient-to-r from-brand-cta to-brand-cta-hover text-white shadow-depth-xl hover:shadow-depth-2xl hover:shadow-brand-cta-shadow/50 transform hover:-translate-y-1.5 hover:scale-[1.03] active:scale-[0.97] focus:outline-none focus:ring-4 focus:ring-brand-cta-ring focus:ring-offset-2 ring-offset-bg-white'
                  : 'bg-bg-gray-50 text-text-dark hover:bg-gradient-to-r hover:from-brand-primary-light hover:to-brand-primary-lighter hover:text-brand-primary hover:shadow-depth-lg border-2 border-transparent hover:border-brand-primary-lighter/50'
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
          className={`w-full px-8 py-5 lg:py-6 rounded-2xl font-bold text-base lg:text-lg transition-all duration-300 mt-auto ${
            isFree
              ? 'bg-gradient-to-r from-brand-secondary to-brand-secondary-hover text-white shadow-depth-xl hover:shadow-depth-2xl hover:shadow-brand-secondary/30 transform hover:-translate-y-1.5 hover:scale-[1.03] active:scale-[0.97] focus:outline-none focus:ring-4 focus:ring-brand-secondary focus:ring-offset-2 ring-offset-bg-white'
              : popular
                ? 'bg-gradient-to-r from-brand-cta to-brand-cta-hover text-white shadow-depth-xl hover:shadow-depth-2xl hover:shadow-brand-cta-shadow/50 transform hover:-translate-y-1.5 hover:scale-[1.03] active:scale-[0.97] focus:outline-none focus:ring-4 focus:ring-brand-cta-ring focus:ring-offset-2 ring-offset-bg-white'
                : 'bg-bg-gray-50 text-text-dark hover:bg-gradient-to-r hover:from-brand-primary-light hover:to-brand-primary-lighter hover:text-brand-primary hover:shadow-depth-lg border-2 border-transparent hover:border-brand-primary-lighter/50'
          }`}
        >
          {t(`plans.${id}.cta`)}
        </button>
      )}
    </div>
  )
}


