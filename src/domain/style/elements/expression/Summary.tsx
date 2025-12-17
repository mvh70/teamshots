'use client'

import React from 'react'
import { ExclamationTriangleIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/solid'
import type { ElementSummaryProps } from '../metadata'
import { resolveExpression } from './config'

interface ExpressionSettings {
  type?: string
}

export function ExpressionSummary({ settings }: ElementSummaryProps<ExpressionSettings>) {
  const [showTooltip, setShowTooltip] = React.useState(false)

  if (!settings) return null

  const expressionType = settings.type
  if (!expressionType) return null

  const expressionConfig = expressionType !== 'user-choice' ? resolveExpression(expressionType) : undefined

  return (
    <div id="style-expression" className="flex flex-col space-y-2">
      <div className="flex items-center gap-2">
        <span className="underline decoration-2 underline-offset-2 font-semibold text-gray-800">Expression</span>
      </div>
      <div className="ml-6 text-sm capitalize">
        {expressionType === 'user-choice' ? (
          <span className="inline-flex items-center gap-1.5 normal-case">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
            <span className="text-gray-600">User choice</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 text-gray-700 normal-case">
            <span className="font-semibold">
              {expressionConfig?.label ?? expressionType}
            </span>
            {expressionConfig?.description && (
              <span
                className="relative inline-block w-4 h-4"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
              >
                <QuestionMarkCircleIcon className="w-4 h-4 text-gray-400 hover:text-brand-secondary transition-colors cursor-help" />
                <span className={`pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2.5 text-xs leading-relaxed text-white shadow-2xl transition-opacity duration-200 ${showTooltip ? 'opacity-100' : 'opacity-0'}`}>
                  {expressionConfig.description}
                </span>
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  )
}
