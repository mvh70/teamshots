'use client'

import { useTranslations } from 'next-intl'
import { ExpressionSettings } from '@/types/photo-style'

interface ExpressionSelectorProps {
  value: ExpressionSettings
  onChange: (settings: ExpressionSettings) => void
  isPredefined?: boolean
  isDisabled?: boolean
  className?: string
  showHeader?: boolean
}

const EXPRESSIONS = [
  { value: 'happy', label: 'Happy', emoji: '😀' },
  { value: 'serious', label: 'Serious', emoji: '😐' },
  { value: 'sad', label: 'Sad', emoji: '😔' },
  { value: 'neutral', label: 'Neutral', emoji: '😶' },
  { value: 'confident', label: 'Confident', emoji: '😎' }
] as const

export default function ExpressionSelector({
  value,
  onChange,
  isPredefined = false,
  isDisabled = false,
  className = '',
  showHeader = false
}: ExpressionSelectorProps) {
  const t = useTranslations('customization.photoStyle.expression')

  const handleChange = (expr: ExpressionSettings['type'], event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    if (isPredefined) return
    onChange({ type: expr })
  }

  return (
    <div className={`${className}`}>
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {t('title', { default: 'Expression' })}
            </h3>
            <p className="text-sm text-gray-600">
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

      <div className={`space-y-3 ${isDisabled ? 'opacity-60 pointer-events-none' : ''}`}>
        {EXPRESSIONS.map((expr) => {
          const isSelected = value.type === expr.value
          return (
            <button
              type="button"
              key={expr.value}
              onClick={(e) => !(isPredefined || isDisabled) && handleChange(expr.value as ExpressionSettings['type'], e)}
              disabled={isPredefined || isDisabled}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                isSelected
                  ? 'border-brand-primary bg-brand-primary-light text-brand-primary'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700'
              } ${(isPredefined || isDisabled) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
            >
              <span className="text-lg leading-none" aria-hidden>
                {expr.emoji}
              </span>
              <span className="text-sm font-medium">{expr.label}</span>
              {isSelected && <div className="ml-auto w-2 h-2 bg-brand-primary rounded-full"></div>}
            </button>
          )
        })}
      </div>
    </div>
  )
}


