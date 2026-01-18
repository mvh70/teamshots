'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useAnalytics } from '@/hooks/useAnalytics'

export interface PromoCodeDiscount {
  type: 'percentage' | 'fixed_amount'
  value: number
  discountAmount: number
  finalAmount: number
}

export interface PromoCodeValidationResult {
  valid: boolean
  error?: string
  discount?: PromoCodeDiscount
  stripePromoCodeId?: string
}

interface PromoCodeInputProps {
  /** Purchase type for validation */
  purchaseType: 'plan' | 'seats' | 'top_up'
  /** Original amount before discount */
  originalAmount: number
  /** Number of seats (for seats purchases) */
  seats?: number
  /** Callback when promo code is successfully applied */
  onApply: (code: string, discount: PromoCodeDiscount, stripePromoCodeId?: string) => void
  /** Callback when promo code is cleared */
  onClear: () => void
  /** Whether a promo code is currently applied */
  isApplied?: boolean
  /** The currently applied code */
  appliedCode?: string
  /** Custom class name */
  className?: string
}

export default function PromoCodeInput({
  purchaseType,
  originalAmount,
  seats,
  onApply,
  onClear,
  isApplied = false,
  appliedCode = '',
  className = '',
}: PromoCodeInputProps) {
  const t = useTranslations('pricing')
  const { track } = useAnalytics()
  const [isOpen, setIsOpen] = useState(false)
  const [code, setCode] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleApply = useCallback(async () => {
    if (!code.trim()) {
      setError(t('promoCode.enterCode'))
      track('promo_code_apply_failed', {
        reason: 'empty_code',
        purchase_type: purchaseType,
      })
      return
    }

    setIsValidating(true)
    setError(null)

    try {
      const response = await fetch('/api/promo-codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          type: purchaseType,
          amount: originalAmount,
          seats,
        }),
      })

      const result: PromoCodeValidationResult = await response.json()

      if (result.valid && result.discount) {
        track('promo_code_applied', {
          code: code.trim().toUpperCase(),
          purchase_type: purchaseType,
          discount_type: result.discount.type,
          discount_value: result.discount.value,
          discount_amount: result.discount.discountAmount,
        })
        onApply(code.trim().toUpperCase(), result.discount, result.stripePromoCodeId)
        setIsOpen(false)
        setCode('')
      } else {
        track('promo_code_apply_failed', {
          code: code.trim().toUpperCase(),
          reason: result.error || 'invalid_code',
          purchase_type: purchaseType,
        })
        setError(result.error || t('promoCode.invalidCode'))
      }
    } catch {
      track('promo_code_apply_failed', {
        code: code.trim().toUpperCase(),
        reason: 'validation_error',
        purchase_type: purchaseType,
      })
      setError(t('promoCode.validationFailed'))
    } finally {
      setIsValidating(false)
    }
  }, [code, purchaseType, originalAmount, seats, onApply, t, track])

  const handleClear = useCallback(() => {
    onClear()
    setCode('')
    setError(null)
  }, [onClear])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleApply()
      }
    },
    [handleApply]
  )

  // If a promo code is already applied, show the applied state
  if (isApplied && appliedCode) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="text-green-700 font-medium">
              {t('promoCode.applied')}: <span className="font-bold">{appliedCode}</span>
            </span>
          </div>
          <button
            onClick={handleClear}
            className="text-green-600 hover:text-green-800 text-sm font-medium"
          >
            {t('promoCode.remove')}
          </button>
        </div>
      </div>
    )
  }

  // Collapsed state - just show "Have a promo code?" link
  if (!isOpen) {
    return (
      <div className={`${className}`}>
        <button
          onClick={() => {
            setIsOpen(true)
            track('promo_code_input_opened', { purchase_type: purchaseType })
          }}
          className="text-brand-primary hover:text-brand-primary-hover text-sm font-medium flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
            />
          </svg>
          {t('promoCode.haveCode')}
        </button>
      </div>
    )
  }

  // Expanded state - show input field
  return (
    <div className={`${className}`}>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
            />
          </svg>
          <span className="text-sm font-medium text-gray-700">{t('promoCode.enterPromoCode')}</span>
          <button
            onClick={() => {
              setIsOpen(false)
              setCode('')
              setError(null)
            }}
            className="ml-auto text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase())
              setError(null)
            }}
            onKeyDown={handleKeyDown}
            placeholder={t('promoCode.placeholder')}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary focus:border-transparent uppercase"
            disabled={isValidating}
          />
          <button
            onClick={handleApply}
            disabled={isValidating || !code.trim()}
            className="px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-medium hover:bg-brand-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isValidating ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              t('promoCode.apply')
            )}
          </button>
        </div>

        {error && (
          <div className="mt-2 text-sm text-red-600 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
