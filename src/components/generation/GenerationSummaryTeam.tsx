import React from 'react'
import { SparklesIcon } from '@heroicons/react/24/outline'
import { calculatePhotosFromCredits } from '@/domain/pricing'

interface GenerationSummaryTeamProps {
  type?: 'team' | 'personal'
  styleLabel: string
  remainingCredits: number
  perGenCredits: number
  onGenerate?: () => void
  generateLabel?: string
  showGenerateButton?: boolean
  showCustomizeHint?: boolean
  teamName?: string
  showTitle?: boolean
  plain?: boolean
  inlineHint?: boolean
}

export default function GenerationSummaryTeam({
  type = 'team',
  styleLabel,
  remainingCredits,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  perGenCredits,
  onGenerate,
  generateLabel,
  showGenerateButton = true,
  showCustomizeHint = false,
  teamName,
  showTitle = true,
  plain = false,
  inlineHint = false,
}: GenerationSummaryTeamProps) {
  const remainingPhotos = calculatePhotosFromCredits(remainingCredits)
  
  const summaryBlock = (
    <div className="text-sm text-gray-700 space-y-2.5">
      <div className="hidden flex items-center gap-2">
        <span className="font-semibold text-gray-900 min-w-[100px]">Type:</span>
        <span className="text-gray-700">{type === 'team' ? `${teamName || 'Team'} use` : 'Personal use'}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-semibold text-gray-900 min-w-[100px]">Style:</span>
        <span className="text-gray-700">{styleLabel}</span>
      </div>
      <div className="hidden flex items-center gap-2">
        <span className="font-semibold text-gray-900 min-w-[100px]">Remaining:</span>
        <span className="text-lg font-bold text-gray-900">{remainingPhotos}</span>
        <span className="text-gray-600 text-xs">photo credits</span>
      </div>
    </div>
  )

  const hintBlock = showCustomizeHint ? (
    <div
      role="note"
      className="w-full md:min-w-[280px] flex items-start gap-4 rounded-xl border border-brand-cta/50 bg-gradient-to-br from-brand-cta-light to-indigo-50/50 p-4 shadow-sm"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-brand-primary/10 flex items-center justify-center">
        <SparklesIcon className="h-5 w-5 text-brand-primary" aria-hidden="true" />
      </div>
      <p className="text-sm leading-relaxed text-gray-700">
        <span className="font-semibold text-brand-primary">Heads up:</span> Customize your photo in the <span className="text-brand-primary font-semibold inline-flex items-center gap-1"><SparklesIcon className="h-4 w-4" aria-hidden="true" />editable</span> sections below before generating.
      </p>
    </div>
  ) : null

  return (
    <div className="space-y-5">
      {showTitle && (
        <h3 className="text-xl font-bold text-gray-900 mb-3 tracking-tight">Generation Summary</h3>
      )}
      <div className={`${plain ? 'p-0' : 'bg-gradient-to-br from-gray-50 to-gray-100/30 rounded-xl p-6'}`}>
        {inlineHint && showCustomizeHint ? (
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
            <div className="w-full p-4 bg-white rounded-lg md:bg-transparent md:p-0 md:min-w-[260px] md:max-w-xs">
              {summaryBlock}
            </div>
            <div className="w-full md:flex-1">{hintBlock}</div>
          </div>
        ) : (
          <>
            {summaryBlock}
            {hintBlock && <div className="mt-4 md:mt-3">{hintBlock}</div>}
          </>
        )}
      </div>
      {showGenerateButton && (
        <button
          type="button"
          onClick={onGenerate}
          className="w-full px-6 py-4 md:px-4 md:py-3 bg-brand-primary text-white rounded-xl md:rounded-md hover:bg-brand-primary/90 text-lg md:text-sm font-semibold md:font-medium transition-colors"
        >
          {generateLabel || 'Generate'}
        </button>
      )}
    </div>
  )
}
