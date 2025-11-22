'use client'

import { useTranslations } from 'next-intl'
import { PRICING_CONFIG } from '@/config/pricing'
import { BRAND_CONFIG } from '@/config/brand'
import { calculatePhotosFromCredits } from '@/domain/pricing'
import { useEffect, useState } from 'react'

interface CreditCostDisplayProps {
  creditCost?: number
  remainingCredits?: number
  creditType?: 'individual' | 'team'
  variant?: 'subtle' | 'prominent' | 'compact'
  showRemaining?: boolean
  className?: string
}

export default function CreditCostDisplay({
  creditCost = PRICING_CONFIG.credits.perGeneration,
  remainingCredits,
  creditType = 'individual',
  variant = 'prominent',
  showRemaining = true,
  className = ''
}: CreditCostDisplayProps) {
  const t = useTranslations('customization')
  const [isLoading, setIsLoading] = useState(true)
  const [credits, setCredits] = useState(remainingCredits)

  // Fetch credits if not provided
  useEffect(() => {
    if (remainingCredits !== undefined) {
      setCredits(remainingCredits)
      setIsLoading(false)
      return
    }

    const fetchCredits = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/credits/balance?type=${creditType}`)
        if (response.ok) {
          const data = await response.json()
          setCredits(data.balance || 0)
        }
      } catch (error) {
        console.error('Failed to fetch credits:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCredits()
  }, [creditType, remainingCredits])

  // Convert credits to photos for display
  const photoCost = calculatePhotosFromCredits(creditCost)
  const remainingPhotos = credits !== undefined ? calculatePhotosFromCredits(credits) : undefined
  const hasEnoughCredits = credits !== undefined && credits >= creditCost

  // Compact variant for inline display
  if (variant === 'compact') {
    return (
      <div className={`inline-flex items-center gap-2 text-sm ${className}`}>
        <span className="font-medium" style={{ color: BRAND_CONFIG.colors.primary }}>
          {photoCost} {photoCost === 1 ? t('photo', { default: 'photo' }) : t('photos', { default: 'photos' })}
        </span>
        {showRemaining && !isLoading && remainingPhotos !== undefined && (
          <span className="text-gray-500">
            ({t('remaining', { default: 'Remaining' })}: {remainingPhotos})
          </span>
        )}
      </div>
    )
  }

  // Subtle variant
  if (variant === 'subtle') {
    return (
      <div 
        className={`rounded-xl p-4 border transition-all duration-200 hover:shadow-sm ${className}`}
        style={{ 
          backgroundColor: `${BRAND_CONFIG.colors.primary}08`,
          borderColor: `${BRAND_CONFIG.colors.primary}20`
        }}
      >
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 font-medium">
            {t('cost', { default: 'Cost' })}:
          </span>
          <span 
            className="font-semibold"
            style={{ color: hasEnoughCredits ? BRAND_CONFIG.colors.primary : '#DC2626' }}
          >
            {photoCost} {photoCost === 1 ? t('photo', { default: 'photo' }) : t('photos', { default: 'photos' })}
          </span>
        </div>
        {showRemaining && !isLoading && remainingPhotos !== undefined && (
          <div 
            className="flex items-center justify-between text-sm mt-3 pt-3 border-t transition-colors"
            style={{ borderColor: `${BRAND_CONFIG.colors.primary}15` }}
          >
            <span className="text-gray-600 font-medium">
              {t('remaining', { default: 'Remaining' })}:
            </span>
            <span 
              className="font-semibold"
              style={{ color: hasEnoughCredits ? BRAND_CONFIG.colors.secondary : '#DC2626' }}
            >
              {remainingPhotos} {remainingPhotos === 1 ? t('photo', { default: 'photo' }) : t('photos', { default: 'photos' })}
            </span>
          </div>
        )}
      </div>
    )
  }

  // Prominent variant (default) - Beautiful redesign
  return (
    <div 
      className={`rounded-2xl p-5 border-2 transition-all duration-300 hover:shadow-lg ${className}`}
      style={{ 
        backgroundColor: `${BRAND_CONFIG.colors.primary}05`,
        borderColor: hasEnoughCredits ? `${BRAND_CONFIG.colors.primary}40` : '#FCA5A5'
      }}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div 
          className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-200 hover:scale-110"
          style={{ 
            backgroundColor: hasEnoughCredits ? BRAND_CONFIG.colors.primary : '#DC2626'
          }}
        >
          <svg
            className="w-5 h-5 text-white"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
            />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 
            className="text-base font-bold mb-3"
            style={{ color: BRAND_CONFIG.colors.primary }}
          >
            {t('generationCost', { default: 'Generation Cost' })}
          </h4>
          
          <div className="space-y-2.5">
            {/* Cost per generation */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 font-medium">
                {t('costPerGeneration', { default: 'Cost per generation' })}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span 
                  className="text-2xl font-bold transition-colors"
                  style={{ color: hasEnoughCredits ? BRAND_CONFIG.colors.primary : '#DC2626' }}
                >
                  {photoCost}
                </span>
                <span 
                  className="text-sm font-semibold"
                  style={{ color: hasEnoughCredits ? BRAND_CONFIG.colors.primary : '#DC2626' }}
                >
                  {photoCost === 1 ? t('photo', { default: 'photo' }) : t('photos', { default: 'photos' })}
                </span>
              </div>
            </div>

            {/* Your balance */}
            {showRemaining && !isLoading && remainingPhotos !== undefined && (
              <div 
                className="flex items-center justify-between pt-2.5 border-t transition-colors"
                style={{ borderColor: `${BRAND_CONFIG.colors.primary}20` }}
              >
                <span className="text-sm text-gray-600 font-medium">
                  {t('yourBalance', { default: 'Your balance' })}
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span 
                    className="text-xl font-bold transition-colors"
                    style={{ color: hasEnoughCredits ? BRAND_CONFIG.colors.secondary : '#DC2626' }}
                  >
                    {remainingPhotos}
                  </span>
                  <span 
                    className="text-sm font-semibold"
                    style={{ color: hasEnoughCredits ? BRAND_CONFIG.colors.secondary : '#DC2626' }}
                  >
                    {remainingPhotos === 1 ? t('photo', { default: 'photo' }) : t('photos', { default: 'photos' })}
                  </span>
                </div>
              </div>
            )}

            {/* Insufficient credits warning */}
            {!hasEnoughCredits && credits !== undefined && (
              <div 
                className="mt-3 pt-3 border-t rounded-lg p-3 transition-all duration-200"
                style={{ 
                  borderColor: '#FCA5A5',
                  backgroundColor: '#FEF2F2'
                }}
              >
                <div className="flex items-start gap-2">
                  <svg 
                    className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                  >
                    <path 
                      fillRule="evenodd" 
                      d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" 
                      clipRule="evenodd" 
                    />
                  </svg>
                  <p className="text-xs text-red-700 font-semibold leading-relaxed">
                    {t('insufficientPhotos', { 
                      default: 'You need {photos} more photos to generate', 
                      photos: calculatePhotosFromCredits(creditCost - credits) 
                    })}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
