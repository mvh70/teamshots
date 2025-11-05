import React from 'react'

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
  const summaryBlock = (
    <div className="text-sm text-gray-600 space-y-1">
      <p><strong>Type:</strong> {type === 'team' ? `${teamName || 'Team'} use` : 'Personal use'}</p>
      <p><strong>Style:</strong> {styleLabel}</p>
      <p>
        <strong>Remaining:</strong>{' '}
        <span className="text-gray-900 font-semibold">{remainingCredits} credits</span>
      </p>
    </div>
  )

  const hintBlock = showCustomizeHint ? (
    <div
      role="note"
      className="w-full md:min-w-[280px] flex items-start gap-3 rounded-md border border-brand-cta/40 bg-brand-cta-light p-3"
    >
      <span className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-brand-cta text-white text-xs font-bold">
        i
      </span>
      <p className="text-[13px] leading-snug text-text-body">
        <span className="font-medium text-brand-cta">Heads up:</span> Some settings are your choice. Review and customize the style below before generating.
      </p>
    </div>
  ) : null

  return (
    <div className="space-y-4">
      {showTitle && (
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Generation Summary</h3>
      )}
      <div className={`${plain ? 'p-0' : 'bg-gray-50 rounded-lg p-4'}`}>
        {inlineHint && showCustomizeHint ? (
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-6">
            <div className="w-full min-w-0 md:min-w-[260px] md:max-w-xs">{summaryBlock}</div>
            <div className="w-full md:flex-1">{hintBlock}</div>
          </div>
        ) : (
          <>
            {summaryBlock}
            {hintBlock && <div className="mt-3">{hintBlock}</div>}
          </>
        )}
      </div>
      {showGenerateButton && (
        <button
          type="button"
          onClick={onGenerate}
          className="w-full py-3 px-4 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 text-sm font-medium"
        >
          {generateLabel || `Generate Professional Photo (${perGenCredits} credits)`}
        </button>
      )}
    </div>
  )
}
