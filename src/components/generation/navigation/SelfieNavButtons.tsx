'use client'

interface SelfieNavButtonsProps {
  onBack: () => void
  onContinue: () => void
  canContinue: boolean
  backLabel: string
  continueLabel: string
}

export default function SelfieNavButtons({
  onBack,
  onContinue,
  canContinue,
  backLabel,
  continueLabel,
}: SelfieNavButtonsProps) {
  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 pr-4 pl-3 h-11 rounded-full border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span className="text-sm font-medium">{backLabel}</span>
      </button>

      <button
        type="button"
        onClick={onContinue}
        disabled={!canContinue}
        className={`flex items-center gap-2 pl-4 pr-3 h-11 rounded-full shadow-sm transition ${
          canContinue
            ? 'bg-brand-primary text-white hover:brightness-110'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        <span className="text-sm font-medium">{continueLabel}</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}

