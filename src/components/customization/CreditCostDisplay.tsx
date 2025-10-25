'use client'

import { useTranslations } from 'next-intl'
import { PRICING_CONFIG } from '@/config/pricing'
import { useEffect, useState } from 'react'

interface CreditCostDisplayProps {
  creditCost?: number
  remainingCredits?: number
  creditType?: 'individual' | 'company'
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

  const hasEnoughCredits = credits !== undefined && credits >= creditCost

  // Compact variant for inline display
  if (variant === 'compact') {
    return (
      <div className={`inline-flex items-center gap-2 text-sm ${className}`}>
        <span className="font-medium text-gray-700">
          {creditCost} {t('credits', { default: 'credits' })}
        </span>
        {showRemaining && !isLoading && (
          <span className="text-gray-500">
            ({t('remaining', { default: 'Remaining' })}: {credits})
          </span>
        )}
      </div>
    )
  }

  // Subtle variant
  if (variant === 'subtle') {
    return (
      <div className={`bg-gray-50 rounded-md p-3 border border-gray-200 ${className}`}>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">
            {t('cost', { default: 'Cost' })}:
          </span>
          <span className={`font-medium ${hasEnoughCredits ? 'text-gray-900' : 'text-red-600'}`}>
            {creditCost} {t('credits', { default: 'credits' })}
          </span>
        </div>
        {showRemaining && !isLoading && (
          <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t border-gray-200">
            <span className="text-gray-600">
              {t('remaining', { default: 'Remaining' })}:
            </span>
            <span className={`font-medium ${hasEnoughCredits ? 'text-green-600' : 'text-red-600'}`}>
              {credits} {t('credits', { default: 'credits' })}
            </span>
          </div>
        )}
      </div>
    )
  }

  // Prominent variant (default)
  return (
    <div className={`bg-blue-50 rounded-lg p-4 border-2 border-blue-200 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <svg
            className="h-5 w-5 text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-blue-900 mb-1">
            {t('generationCost', { default: 'Generation Cost' })}
          </h4>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-700">
                {t('costPerGeneration', { default: 'Cost per generation' })}:
              </span>
              <span className={`text-sm font-bold ${hasEnoughCredits ? 'text-blue-900' : 'text-red-600'}`}>
                {creditCost} {t('credits', { default: 'credits' })}
              </span>
            </div>
            {showRemaining && !isLoading && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-700">
                  {t('yourBalance', { default: 'Your balance' })}:
                </span>
                <span className={`text-sm font-bold ${hasEnoughCredits ? 'text-green-700' : 'text-red-600'}`}>
                  {credits} {t('credits', { default: 'credits' })}
                </span>
              </div>
            )}
            {!hasEnoughCredits && credits !== undefined && (
              <div className="mt-2 pt-2 border-t border-blue-200">
                <p className="text-xs text-red-700 font-medium">
                  ⚠️ {t('insufficientCredits', { default: 'You need {credits} more credits to generate', credits: creditCost - credits })}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
