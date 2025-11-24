'use client'

import { useTranslations } from 'next-intl'
import { ExpressionSettings } from '@/types/photo-style'
import { EXPRESSION_CONFIGS, ExpressionType } from './config'

interface ExpressionSelectorProps {
  value: ExpressionSettings
  onChange: (settings: ExpressionSettings) => void
  isPredefined?: boolean
  isDisabled?: boolean
  className?: string
  showHeader?: boolean
  availableExpressions?: string[]
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

  const handleChange = (type: ExpressionType, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    if (isPredefined) return
    onChange({ type })
  }

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
        {visibleExpressions.map((expr) => {
          const isSelected = value.type === expr.value
          // On mobile, hide unselected options when predefined
          const shouldHide = isPredefined && !isSelected
          
          return (
            <button
              type="button"
              key={expr.value}
              onClick={(e) =>
                !(isPredefined || isDisabled) &&
                handleChange(expr.value, e)
              }
              disabled={isPredefined || isDisabled}
              className={`w-full bg-gray-50 rounded-lg p-4 border-2 transition-all ${
                isSelected
                  ? 'border-brand-primary bg-brand-primary-light shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-white hover:shadow-sm'
              } ${(isPredefined || isDisabled) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${
                shouldHide ? 'hidden md:block' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-2xl ${
                  isSelected 
                    ? `bg-gradient-to-br ${expr.color}` 
                    : 'bg-gray-200'
                }`}>
                  {expr.icon}
                </div>
                <div className="flex-1 text-left">
                  <div className={`text-sm font-semibold ${isSelected ? 'text-brand-primary' : 'text-gray-900'}`}>
                    {expr.label}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {expr.description}
                  </div>
                </div>
                {isSelected && (
                  <div className="w-5 h-5 bg-brand-primary rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

