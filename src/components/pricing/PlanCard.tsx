'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { calculatePhotosFromCredits } from '@/domain/pricing'

type PlanId = 'proSmall' | 'proLarge' | 'individual'

interface PlanCardProps {
  id: PlanId
  price: string
  credits: number
  pricePerPhoto?: string
  popular?: boolean
  actionMode?: 'link' | 'button'
  href?: string
  onSelect?: () => void
  className?: string
}

export default function PlanCard({
  id,
  price,
  credits,
  pricePerPhoto,
  popular,
  actionMode = 'link',
  href,
  onSelect,
  className,
}: PlanCardProps) {
  const t = useTranslations('pricing')

  const displayPrice = price

  const displayPeriod = 'one-time'
  const displayPricePerPhoto = pricePerPhoto

  const borderColor = id === 'individual'
      ? 'border-2 border-gray-200'
      : popular
        ? 'ring-3 ring-brand-cta-ring border-2 border-brand-cta-ring scale-105 shadow-brand-cta-shadow'
        : 'ring-2 ring-brand-premium-ring border-2 border-brand-premium-ring'

  const card = (
    <div className={`relative bg-white rounded-2xl shadow-lg p-6 ${borderColor} transition-all duration-300 hover:shadow-xl flex flex-col h-full ${className || ''}`}>
      {popular && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-gradient-to-r from-brand-cta to-brand-cta-ring text-white px-6 py-2 rounded-full text-base font-bold shadow-lg">
            {t('mostPopular')}
          </div>
        </div>
      )}

      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2">{t(`plans.${id}.name`)}</h3>
        <p className="text-gray-600 mb-4">{t(`plans.${id}.description`)}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-gray-900">{displayPrice}</span>
          <span className="text-gray-600 whitespace-nowrap text-sm leading-none">{displayPeriod}</span>
        </div>
        <p className="text-sm text-brand-primary font-semibold mt-2">
          {t('photoCount', { count: calculatePhotosFromCredits(credits) })}
        </p>
        {displayPricePerPhoto && (
          <div className="mt-4">
            <span className="text-sm text-gray-700 font-semibold">
              {displayPricePerPhoto} {t('perPhotoVariation')}
            </span>
          </div>
        )}
      </div>

      {/* Features list (basic) - reuse translations */}
      <ul className="space-y-3 mb-8 flex-grow">
        {(t.raw(`plans.${id}.features`) as string[]).map((feature: string) => (
          <li key={feature} className="flex items-start gap-3 text-gray-700">
            <svg className="w-5 h-5 text-brand-secondary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {actionMode === 'link' && href && (
        <Link
          href={href}
          className={`block w-full text-center px-6 py-3 rounded-lg font-semibold transition-all duration-300 mt-auto ${
            popular ? 'bg-brand-cta text-white hover:bg-brand-cta-hover shadow-lg' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
          }`}
        >
          {t(`plans.${id}.cta`)}
        </Link>
      )}

      {actionMode === 'button' && onSelect && (
        <button
          type="button"
          onClick={onSelect}
          className={`w-full px-6 py-3 rounded-lg font-semibold transition-all duration-300 mt-auto ${
            popular ? 'bg-brand-cta text-white hover:bg-brand-cta-hover shadow-lg' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
          }`}
        >
          {t(`plans.${id}.cta`)}
        </button>
      )}
    </div>
  )

  return card
}


