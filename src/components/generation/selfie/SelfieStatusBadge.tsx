import type { ReactNode } from 'react'

interface SelfieStatusBadgeLabels {
  readyLabel: string
  selectingLabel: string
}

interface SelfieStatusBadgeContent {
  readyContent: ReactNode
  selectingContent: ReactNode
}

export function buildSelfieStatusBadge(labels: SelfieStatusBadgeLabels): SelfieStatusBadgeContent {
  return {
    readyContent: (
      <>
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
        {labels.readyLabel}
      </>
    ),
    selectingContent: (
      <>
        <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        {labels.selectingLabel}
      </>
    ),
  }
}

