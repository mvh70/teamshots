'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { ExpressionSettings } from '@/types/photo-style'
import { EXPRESSION_CONFIGS } from './config'
import type { ExpressionType } from './types'
import { ImagePreview } from '@/components/ui/ImagePreview'

interface ExpressionSelectorProps {
  value: ExpressionSettings
  onChange: (settings: ExpressionSettings) => void
  isPredefined?: boolean
  isDisabled?: boolean
  className?: string
  showHeader?: boolean
  availableExpressions?: string[]
}

const EXPRESSIONS_WITH_IMAGES = [
  'genuine_smile',
  'laugh_joy',
  'neutral_serious',
  'soft_smile'
] as const

function hasExpressionImage(expressionId: string): boolean {
  return EXPRESSIONS_WITH_IMAGES.includes(expressionId as typeof EXPRESSIONS_WITH_IMAGES[number])
}

export default function ExpressionSelector({
  value,
  onChange,
  isPredefined = false,
  isDisabled = false,
  className = '',
  showHeader = false,
  availableExpressions
}: ExpressionSelectorProps) {
  const t = useTranslations('customization.photoStyle.expression')

  const visibleExpressions = availableExpressions
    ? EXPRESSION_CONFIGS.filter(e => availableExpressions.includes(e.value))
    : EXPRESSION_CONFIGS

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (isPredefined) return
    onChange({ type: event.target.value as ExpressionType })
  }

  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  // Find the currently selected expression to show its description
  const selectedExpression = visibleExpressions.find(e => e.value === value.type)

  // Use effective value to handle initial load
  const effectiveExpressionType = value.type

  return (
    <div className={`${className}`}>
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {t('title', { default: 'Expression' })}
            </h3>
            <p className="hidden md:block text-sm text-gray-600">
              {t('subtitle', { default: 'Choose a facial expression' })}
            </p>
          </div>
          {isPredefined && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {t('predefined', { default: 'Predefined' })}
            </span>
          )}
        </div>
      )}

      <div className={`space-y-4 ${isDisabled ? 'opacity-60 pointer-events-none' : ''}`}>
        <div className="relative">
          <select
            value={value.type}
            onChange={handleChange}
            disabled={isPredefined || isDisabled}
            className={`block w-full rounded-lg border-2 border-gray-200 p-3 pr-10 text-base focus:border-brand-primary focus:outline-none focus:ring-brand-primary sm:text-sm ${
              (isPredefined || isDisabled) ? 'cursor-not-allowed bg-gray-50' : 'cursor-pointer bg-white'
            }`}
          >
            {value.type === 'user-choice' && (
              <option value="user-choice" disabled>
                {t('selectPlaceholder', { default: 'Choose your expression' })}
              </option>
            )}
            {visibleExpressions.map((expr) => (
              <option key={expr.value} value={expr.value}>
                {t(`expressions.${expr.value}.label`)}
              </option>
            ))}
          </select>
        </div>

        {/* Selected Expression Description */}
        {selectedExpression && (
          <p className="text-sm text-gray-600 px-1">
            {t(`expressions.${selectedExpression.value}.description`)}
          </p>
        )}

        {/* Conditional Image Preview */}
        {hasExpressionImage(effectiveExpressionType) && (
          <div className="mt-4">
            <ImagePreview
              key={effectiveExpressionType} // Force re-render on value change
              src={`/images/expressions/${effectiveExpressionType}.png`}
              alt={t(`expressions.${effectiveExpressionType}.label`)}
              width={400}
              height={300}
              variant="preview"
              className="w-full h-auto object-cover rounded-lg shadow-sm border border-gray-200"
              priority={true} // Add priority to ensure it loads immediately
              unoptimized={true} // Ensure we bypass optimization to avoid stale cache or loading issues
            />
          </div>
        )}
      </div>
    </div>
  )
}
