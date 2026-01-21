'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { ExclamationTriangleIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/solid'
import type { ElementSummaryProps } from '../metadata'
import type { ExpressionSettings } from './types'
import { resolveExpression } from './config'
import { isUserChoice, hasValue } from '../base/element-types'

export function ExpressionSummary({ settings }: ElementSummaryProps<ExpressionSettings>) {
  const t = useTranslations('customization.photoStyle.expression')
  const [showTooltip, setShowTooltip] = React.useState(false)

  if (!settings) return null

  const userChoice = isUserChoice(settings)
  const expressionType = userChoice ? 'user-choice' : (hasValue(settings) ? settings.value.type : undefined)
  if (!expressionType) return null

  const expressionConfig = expressionType !== 'user-choice' ? resolveExpression(expressionType) : undefined

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100/80 last:border-0">
      <span className="text-[13px] text-gray-500">Expression</span>
      <div className="text-[13px]">
        {expressionType === 'user-choice' ? (
          <span className="inline-flex items-center gap-1.5 text-amber-600">
            <ExclamationTriangleIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>User choice</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-gray-800 font-medium">
              {t(`expressions.${expressionType}.label`, {
                default: expressionType.replace(/_/g, ' ')
              })}
            </span>
            {t(`expressions.${expressionType}.description`, { default: '' }) && (
              <button
                type="button"
                className="relative inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 rounded"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onFocus={() => setShowTooltip(true)}
                onBlur={() => setShowTooltip(false)}
                aria-label="Expression information"
                aria-describedby="expression-tooltip"
              >
                <QuestionMarkCircleIcon className="h-3.5 w-3.5 text-gray-400 hover:text-brand-primary transition-colors" aria-hidden="true" />
                <span
                  id="expression-tooltip"
                  role="tooltip"
                  className={`pointer-events-none absolute right-0 top-full z-50 mt-2 w-52 rounded-lg bg-gray-900 px-3 py-2 text-xs leading-relaxed text-white shadow-xl transition-opacity duration-200 ${showTooltip ? 'opacity-100' : 'opacity-0'}`}
                >
                  {t(`expressions.${expressionType}.description`, { default: '' })}
                </span>
              </button>
            )}
          </span>
        )}
      </div>
    </div>
  )
}
