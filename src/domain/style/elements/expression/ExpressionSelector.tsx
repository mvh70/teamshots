'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { ExpressionSettings } from '@/types/photo-style'
import { EXPRESSION_CONFIGS } from './config'
import type { ExpressionType } from './types'
import { ImagePreview } from '@/components/ui/ImagePreview'
import { predefined, userChoice } from '../base/element-types'

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

function hasExpressionImage(expressionId: string | undefined): boolean {
  if (!expressionId) return false
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

  // Extract the current value for easier access
  const exprValue = value?.value

  // Helper to preserve mode when updating value
  // CRITICAL: Preserves predefined mode when admin is editing a predefined setting
  const wrapWithCurrentMode = (newValue: { type: ExpressionType }): ExpressionSettings => {
    return value?.mode === 'predefined' ? predefined(newValue) : userChoice(newValue)
  }

  const visibleExpressions = availableExpressions
    ? EXPRESSION_CONFIGS.filter(e => availableExpressions.includes(e.value))
    : EXPRESSION_CONFIGS

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (isPredefined) return
    onChange(wrapWithCurrentMode({ type: event.target.value as ExpressionType }))
  }

  // Find the currently selected expression to show its description (uses selectValue to include default)

  // For the select value, use first available expression if none selected
  const selectValue = exprValue?.type || (visibleExpressions[0]?.value ?? 'genuine_smile')

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
            value={selectValue}
            onChange={handleChange}
            disabled={isPredefined || isDisabled}
            className={`block w-full rounded-lg border-2 border-gray-200 p-3 pr-10 text-base focus:border-brand-primary focus:outline-none focus:ring-brand-primary sm:text-sm ${
              (isPredefined || isDisabled) ? 'cursor-not-allowed bg-gray-50' : 'cursor-pointer bg-white'
            }`}
          >
            {visibleExpressions.map((expr) => (
              <option key={expr.value} value={expr.value}>
                {t(`expressions.${expr.value}.label`)}
              </option>
            ))}
          </select>
        </div>

        {/* Selected Expression Description */}
        {selectValue && (
          <p className="text-sm text-gray-600 px-1">
            {t(`expressions.${selectValue}.description`)}
          </p>
        )}

        {/* Conditional Image Preview - use selectValue to show preview for default/fallback expression too */}
        {selectValue && hasExpressionImage(selectValue) && (
          <div className="mt-4">
            <ImagePreview
              src={`/images/expressions/${selectValue}.png`}
              alt={t(`expressions.${selectValue}.label`)}
              width={400}
              height={300}
              variant="preview"
              className="w-full h-auto object-cover rounded-lg shadow-sm border border-gray-200"
              priority={true}
              unoptimized={true}
              showLoadingSpinner={false}
            />
          </div>
        )}
      </div>
    </div>
  )
}
