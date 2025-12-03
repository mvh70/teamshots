'use client'

import { useTranslations } from 'next-intl'
import { calculatePhotosFromCredits, calculatePricePerPhoto, formatPrice } from '@/domain/pricing'
import { PRICING_CONFIG } from '@/config/pricing'
import { useAnalytics } from '@/hooks/useAnalytics'
import { TrackedLink } from '@/components/TrackedLink'

type PlanId = 'pro' | 'proSmall' | 'proLarge' | 'individual' | 'tryItForFree' | 'vip' | 'enterprise'

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
  isVip?: boolean
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
  isVip,
}: PricingCardProps) {
  const t = useTranslations('pricing')
  const tAll = useTranslations()
  const { track } = useAnalytics()

  // Match pricing page calculations
  const numberOfPhotos = calculatePhotosFromCredits(credits)
  const displayPrice = price
  const displayPricePerPhoto = pricePerPhoto
  
  // Calculate total photos including retries: numberOfPhotos × (1 original + regenerations)
  const regenerationCount = regenerations || 2
  const totalPhotos = numberOfPhotos * (1 + regenerationCount)
  const variationsPerPhoto = 1 + regenerationCount

  // Calculate top-up price per photo
  let topUpPricePerPhoto = ''
  if (id !== 'tryItForFree') {
    const topUpConfig = id === 'individual' 
      ? PRICING_CONFIG.individual.topUp
      : id === 'proSmall'
        ? PRICING_CONFIG.proSmall.topUp
        : PRICING_CONFIG.proLarge.topUp
    
    const topUpRegenerations = id === 'individual'
      ? PRICING_CONFIG.regenerations.individual
      : id === 'proSmall'
        ? PRICING_CONFIG.regenerations.proSmall
        : PRICING_CONFIG.regenerations.proLarge
    
    const topUpPricePerPhotoValue = calculatePricePerPhoto(
      topUpConfig.price,
      topUpConfig.credits,
      topUpRegenerations
    )
    topUpPricePerPhoto = formatPrice(topUpPricePerPhotoValue)
  }

  const rawFeatures = t.raw(`plans.${id}.features`) as string[]
  const totalShots = regenerationCount + 1 // Original + regenerations
  
  // Get pluralized photos text from translations
  const photosText = t('customizablePhotos', { count: numberOfPhotos })
  
  // Prepare variables for interpolation
  const interpolationValues = {
    photosText,
    regenerations: regenerationCount,
    shots: totalShots,
    photos: numberOfPhotos,
    totalPhotos,
    variations: variationsPerPhoto,
    topUpPricePerPhoto,
  }
  
  // Use translation interpolation - map each feature and use t() with proper variables
  const features = rawFeatures.map((_, index) => {
    // Use t() with the full key path and variables for proper interpolation
    return t(`plans.${id}.features.${index}`, interpolationValues)
  })
  const extras: string[] = []
  // Removed: High quality downloads and Style packages (no longer needed)
  const featuresWithPhotos = [...features, ...extras]
  const adjustedFeatures = id === 'tryItForFree'
    ? featuresWithPhotos.map(f => f.toLowerCase().includes('support') ? 'No support' : f)
    : featuresWithPhotos

  const isFree = id === 'tryItForFree'
  const isVipTier = isVip || id === 'vip' || id === 'enterprise'
  const borderColor = isVipTier
    ? 'ring-4 ring-amber-400/50 border-[3px] border-amber-500 shadow-depth-2xl shadow-amber-500/30'
    : popular
      ? 'ring-4 ring-brand-cta-ring/40 border-[3px] border-brand-cta-ring scale-105 shadow-depth-2xl shadow-brand-cta-shadow/60'
      : isFree
        ? 'ring-2 ring-brand-secondary/30 border-2 border-brand-secondary/40'
        : (id === 'proLarge'
            ? 'ring-2 ring-brand-premium-ring/40 border-2 border-brand-premium-ring'
            : 'border-2 border-brand-primary-lighter/60')

  return (
    <div className={`relative bg-bg-white rounded-2xl lg:rounded-3xl shadow-depth-xl p-4 sm:p-6 lg:p-6 xl:p-8 ${borderColor} transition-all duration-500 hover:shadow-depth-2xl hover:-translate-y-2 flex flex-col min-h-[550px] lg:min-h-[600px] overflow-visible ${className || ''} ${isFree ? 'bg-gradient-to-br from-bg-white via-bg-white to-brand-secondary-light/40' : ''} ${isVipTier ? 'bg-gradient-to-br from-amber-50 via-bg-white to-amber-100/50' : ''} ${popular ? 'lg:mt-[-16px] lg:mb-[16px] z-10' : ''}`}>
      {/* Most Popular badge - shown in top right for popular plans */}
      {popular && (
        <div className="absolute -top-3 right-3 lg:-top-4 lg:right-4 z-10">
          <span className="inline-flex items-center px-3 py-1.5 lg:px-4 lg:py-2 rounded-full text-[10px] lg:text-xs font-bold bg-gradient-to-r from-brand-cta to-brand-cta-hover text-white shadow-depth-lg ring-2 ring-white whitespace-nowrap">
            {popularLabel || (popularLabelKey ? (popularLabelKey.includes('.') ? tAll(popularLabelKey) : t(popularLabelKey)) : t('mostPopular'))}
          </span>
        </div>
      )}
      {/* FREE badge - shown in top right for free tier */}
      {isFree && !popular && (
        <div className="absolute -top-3 right-3 lg:-top-4 lg:right-4 z-10">
          <span className="inline-flex items-center px-3 py-1.5 lg:px-4 lg:py-2 rounded-full text-[10px] lg:text-xs font-bold bg-gradient-to-r from-brand-secondary to-brand-secondary-hover text-white shadow-depth-lg ring-2 ring-white">
            FREE
          </span>
        </div>
      )}

      <div className="mb-4 lg:mb-6">
        <h3 className={`text-xl lg:text-2xl font-bold mb-2 lg:mb-3 font-display leading-tight ${isFree ? 'text-brand-secondary' : isVipTier ? 'text-amber-600' : 'text-text-dark'}`}>
          {titleOverride || t(`plans.${id}.name`)}
        </h3>
        <p className="text-sm lg:text-base text-text-body mb-4 lg:mb-6 leading-relaxed">{descriptionOverride || t(`plans.${id}.description`, interpolationValues)}</p>
        
        {/* Price */}
        <div className="mb-4">
          {previousPrice && (
            <span className="text-lg lg:text-xl font-semibold text-text-muted line-through mb-1 block">
              {previousPrice}
            </span>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-3xl lg:text-4xl xl:text-5xl font-black leading-none ${isFree ? 'bg-gradient-to-r from-brand-secondary to-brand-secondary-hover bg-clip-text text-transparent' : isVipTier ? 'bg-gradient-to-r from-amber-500 to-amber-600 bg-clip-text text-transparent' : 'text-text-dark'}`}>
              {displayPrice}
            </span>
            {!isFree && (
              <span className="text-xs lg:text-sm font-medium text-text-muted">
                {t('oneTimePayment')}
              </span>
            )}
          </div>
        </div>

        {/* Per photo pricing - the key value prop */}
        {!isFree && displayPricePerPhoto && (
          <div className="relative group mb-4">
            <div className={`relative overflow-hidden rounded-xl p-0.5 shadow-depth-md ${isVipTier ? 'bg-gradient-to-br from-amber-400 to-amber-600' : 'bg-gradient-to-br from-brand-secondary via-brand-secondary-hover to-brand-secondary'}`}>
              <div className="bg-bg-white rounded-[10px] px-3 py-3 lg:px-4 lg:py-4">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className={`text-xl lg:text-2xl xl:text-3xl font-black ${isVipTier ? 'text-amber-600' : 'text-text-dark'}`}>{displayPricePerPhoto}</span>
                  <span className="text-xs lg:text-sm font-semibold text-text-body">per photo</span>
                </div>
                <div className={`text-[10px] lg:text-xs font-medium mt-1.5 ${isVipTier ? 'text-amber-600/80' : 'text-text-muted'}`}>
                  {numberOfPhotos} customizable {numberOfPhotos === 1 ? 'photo' : 'photos'}, generated {variationsPerPhoto} {variationsPerPhoto === 1 ? 'time' : 'times'}.
                </div>
                <div className={`text-[10px] lg:text-xs font-semibold ${isVipTier ? 'text-amber-600' : 'text-brand-secondary'}`}>
                  Choose the best.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Free tier - show what you get */}
        {isFree && (
          <div className="relative group mb-4">
            <div className="bg-brand-secondary-light/50 rounded-xl px-3 py-3 lg:px-4 lg:py-4">
              <div className="text-xs lg:text-sm font-medium text-brand-secondary">
                {numberOfPhotos} customizable {numberOfPhotos === 1 ? 'photo' : 'photos'}, generated {variationsPerPhoto} {variationsPerPhoto === 1 ? 'time' : 'times'}.
              </div>
              <div className="text-xs lg:text-sm font-semibold text-brand-secondary">
                Choose the best.
              </div>
            </div>
          </div>
        )}
      </div>

      <ul className="space-y-2 lg:space-y-3 mb-6 lg:mb-8 flex-grow">
        {adjustedFeatures.map((feature) => (
          <li key={feature} className="flex items-start gap-2 lg:gap-3 group/item">
            <div className={`flex-shrink-0 mt-0.5 w-5 h-5 lg:w-6 lg:h-6 rounded-full flex items-center justify-center ${isVipTier ? 'bg-amber-100' : 'bg-brand-secondary-light'} group-hover/item:scale-110 transition-all duration-200`}>
              <svg className={`w-3 h-3 lg:w-3.5 lg:h-3.5 ${isVipTier ? 'text-amber-600' : 'text-brand-secondary'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-xs lg:text-sm text-text-body leading-relaxed font-medium" dangerouslySetInnerHTML={{ __html: feature }} />
          </li>
        ))}
      </ul>

      {/* Unified button styling for all CTA types */}
      {(() => {
        // Unified base classes for all button types
        const baseButtonClasses = 'w-full text-center px-4 py-3 lg:px-6 lg:py-4 min-h-[3.5rem] lg:min-h-[4rem] rounded-xl lg:rounded-2xl font-bold text-sm lg:text-base transition-all duration-300 mt-auto flex items-center justify-center'
        
        // Variant-specific classes
        const variantClasses = isVipTier
          ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-depth-xl hover:shadow-depth-2xl hover:shadow-amber-500/30 transform hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98]'
          : isFree
            ? 'bg-gradient-to-r from-brand-secondary to-brand-secondary-hover text-white shadow-depth-xl hover:shadow-depth-2xl hover:shadow-brand-secondary/30 transform hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98]'
            : popular
              ? 'bg-gradient-to-r from-brand-cta to-brand-cta-hover text-white shadow-depth-xl hover:shadow-depth-2xl hover:shadow-brand-cta-shadow/50 transform hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98]'
              : 'bg-bg-gray-50 text-text-dark hover:bg-gradient-to-r hover:from-brand-primary-light hover:to-brand-primary-lighter hover:text-brand-primary hover:shadow-depth-lg border-2 border-transparent hover:border-brand-primary-lighter/50'

        if (ctaSlot) {
          return <div className="mt-auto">{ctaSlot}</div>
        }

        if (ctaMode === 'link' && href) {
          return (
            <TrackedLink
              href={href}
              event="cta_clicked"
              eventProperties={{
                placement: 'pricing_card',
                plan: id,
                mode: 'link',
              }}
              className={`${baseButtonClasses} ${variantClasses}`}
            >
              {t(`plans.${id}.cta`)}
            </TrackedLink>
          )
        }

        if (ctaMode === 'button' && onCta) {
          return (
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
              className={`${baseButtonClasses} ${variantClasses}`}
            >
              {t(`plans.${id}.cta`)}
            </button>
          )
        }

        return null
      })()}
    </div>
  )
}


