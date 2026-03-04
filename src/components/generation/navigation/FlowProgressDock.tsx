'use client'

import React from 'react'
import { createPortal } from 'react-dom'
import { SparklesIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon, ChevronDownIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { MIN_SELFIES_REQUIRED } from '@/constants/generation'
import Tooltip from '@/components/ui/Tooltip'
import { SmallLoadingSpinner } from '@/components/ui/LoadingSpinner'
import type { CustomizationStepsMeta } from '@/lib/customizationSteps'

interface FlowProgressDockProps {
  /** Number of selfies currently selected */
  selfieCount: number
  /** Minimum selfies required (default: MIN_SELFIES_REQUIRED) */
  requiredSelfies?: number
  /** Whether there are unedited fields */
  hasUneditedFields: boolean
  /** Whether user has enough credits */
  hasEnoughCredits: boolean
  /** Current step in the flow */
  currentStep: 'selfies' | 'beautification' | 'customize' | 'tips' | 'intro'
  /** Navigate to previous step in the flow */
  onNavigateToPreviousStep: () => void
  /** Navigate directly to selfie selection step (defaults to previous-step handler) */
  onNavigateToSelfieStep?: () => void
  /** @deprecated Use onNavigateToPreviousStep/onNavigateToSelfieStep */
  onNavigateToSelfies?: () => void
  /** Navigate to customization */
  onNavigateToCustomize: () => void
  /** Trigger generation */
  onGenerate?: () => void
  /** Whether generation is in progress */
  isGenerating?: boolean
  /** Additional CSS classes */
  className?: string
  /** Navigate back to dashboard */
  onNavigateToDashboard?: () => void
  /** Action to buy credits */
  onBuyCredits?: () => void
  /** Customization steps metadata for progress dots */
  customizationStepsMeta?: CustomizationStepsMeta
  /** Indices of visited/completed editable steps */
  visitedEditableSteps?: number[]
  /** Handler for "Don't show again" action on tips/intro pages */
  onDontShowAgain?: () => void
  /** Text for the "Don't show again" button */
  dontShowAgainText?: string
  /** Called when user clicks disabled generate due to missing customization */
  onAttemptDisabledGenerate?: () => void
  /** Specific reason text for disabled generate */
  disabledGenerateReason?: string
}

/**
 * Desktop-only progress dock for the generation flow.
 * Shows navigation buttons on top row, progress indicators on bottom row.
 *
 * Layout:
 * ┌─────────────────────────────────────────────────────────────┐
 * │  ← Back                                      Continue →     │
 * │  ─────────────────────────────────────────────────────────  │
 * │    SELFIES          CUSTOMIZE              GENERATE         │
 * │      ✓               ● ● ○                   ✨              │
 * │   3 added          Step 2 of 3              Ready           │
 * └─────────────────────────────────────────────────────────────┘
 */
export default function FlowProgressDock({
  selfieCount,
  requiredSelfies = MIN_SELFIES_REQUIRED,
  hasUneditedFields,
  hasEnoughCredits,
  currentStep,
  onNavigateToPreviousStep,
  onNavigateToSelfieStep,
  onNavigateToSelfies,
  onNavigateToCustomize,
  onGenerate,
  onNavigateToDashboard,
  onBuyCredits,
  isGenerating = false,
  className = '',
  customizationStepsMeta,
  visitedEditableSteps = [],
  onDontShowAgain,
  dontShowAgainText,
  onAttemptDisabledGenerate,
  disabledGenerateReason
}: FlowProgressDockProps) {
  const t = useTranslations('generation.progressDock')
  const navigateToPreviousStep = onNavigateToPreviousStep ?? onNavigateToSelfies ?? (() => undefined)
  const navigateToSelfieStep = onNavigateToSelfieStep ?? onNavigateToSelfies ?? navigateToPreviousStep

  const hasEnoughSelfies = selfieCount >= requiredSelfies

  // Compute if customization is complete based on visited steps
  // If editableSteps is 0 (admin preset everything), customization is complete
  const isCustomizationComplete = customizationStepsMeta
    ? customizationStepsMeta.editableSteps === 0 || visitedEditableSteps.length >= customizationStepsMeta.editableSteps
    : false

  // Use computed value if on a non-customize page, otherwise use the passed prop
  const effectiveHasUneditedFields = currentStep === 'customize'
    ? hasUneditedFields
    : !isCustomizationComplete

  const getCustomizeStatusText = (): string => {
    if (!hasEnoughSelfies) {
      return t('customize.locked')
    }
    if (isCustomizationComplete) {
      return t('customize.complete')
    }
    // Show step progress if we have metadata
    if (customizationStepsMeta && customizationStepsMeta.editableSteps > 0) {
      const completed = visitedEditableSteps.length
      const total = customizationStepsMeta.editableSteps
      return t('customize.stepProgress', {
        current: completed,
        total,
        default: `Step ${completed} of ${total}`
      })
    }
    return t('customize.notStarted', { default: 'Customize your photos' })
  }

  // Navigation logic
  const isOnSelfies = currentStep === 'selfies' || currentStep === 'tips'
  const isOnBeautification = currentStep === 'beautification'
  const isOnCustomize = currentStep === 'customize' || currentStep === 'intro'

  // Back button config
  const getBackConfig = () => {
    if (isOnSelfies) {
      return {
        label: t('navigation.dashboard', { default: 'Dashboard' }),
        onClick: onNavigateToDashboard || navigateToPreviousStep,
        disabled: false
      }
    }
    if (isOnBeautification) {
      return {
        label: t('navigation.selfies', { default: 'Selfies' }),
        onClick: navigateToPreviousStep,
        disabled: false
      }
    }
    if (isOnCustomize) {
      return {
        label: t('navigation.beautification', { default: 'Beautification' }),
        onClick: navigateToPreviousStep,
        disabled: false
      }
    }
    return {
      label: t('navigation.back', { default: 'Back' }),
      onClick: navigateToPreviousStep,
      disabled: false
    }
  }

  // Continue button config
  const getContinueConfig = () => {
    // On selfie-tips page, show "Selfies →" button to navigate to selfie selection
    if (currentStep === 'tips') {
      return {
        label: t('navigation.selfies', { default: 'Selfies' }),
        onClick: navigateToSelfieStep,
        disabled: false
      }
    }
    if (currentStep === 'selfies') {
      const canContinue = hasEnoughSelfies
      return {
        label: t('navigation.beautification', { default: 'Beautification' }),
        onClick: onNavigateToCustomize,
        disabled: !canContinue,
        tooltip: !canContinue ? t('tooltips.needSelfies', { count: requiredSelfies }) : undefined
      }
    }
    if (currentStep === 'beautification') {
      return {
        label: t('navigation.customize', { default: 'Customize' }),
        onClick: onNavigateToCustomize,
        disabled: !hasEnoughSelfies,
        tooltip: !hasEnoughSelfies ? t('tooltips.needSelfies', { count: requiredSelfies }) : undefined
      }
    }
    // On customization-intro page, show "Customize →" button to navigate to customization
    if (currentStep === 'intro') {
      return {
        label: t('navigation.customize', { default: 'Customize' }),
        onClick: onNavigateToCustomize,
        disabled: false
      }
    }
    if (isOnCustomize) {
      const canContinue = isCustomizationComplete && hasEnoughCredits
      const isGenerate = isCustomizationComplete

      if (!hasEnoughCredits && onBuyCredits) {
        return {
          label: t('generate.buyCredits', { default: 'Buy Credits' }),
          onClick: onBuyCredits,
          disabled: false,
          isCredits: true
        }
      }

      return {
        label: isGenerate
          ? t('generate.label', { default: 'Generate' })
          : t('navigation.generate', { default: 'Generate' }),
        onClick: onGenerate || (() => undefined),
        disabled: !canContinue || !onGenerate,
        tooltip: !canContinue
          ? (!isCustomizationComplete
              ? (disabledGenerateReason || t('tooltips.needCustomization'))
              : t('tooltips.needCredits'))
          : undefined,
        isGenerate: isGenerate && canContinue
      }
    }
    return {
      label: t('navigation.continue', { default: 'Continue' }),
      onClick: onNavigateToCustomize,
      disabled: true
    }
  }

  const backConfig = getBackConfig()
  const continueConfig = getContinueConfig()
  const continueIsDisabled = continueConfig.disabled || isGenerating
  const canGuideDisabledClick = isOnCustomize && !isCustomizationComplete && !!onAttemptDisabledGenerate && continueConfig.disabled && !isGenerating
  const continueIsHardDisabled = isGenerating || (continueConfig.disabled && !canGuideDisabledClick)
  const handleContinueClick = () => {
    if (continueIsHardDisabled) {
      return
    }
    if (canGuideDisabledClick) {
      if (onAttemptDisabledGenerate) {
        onAttemptDisabledGenerate()
      }
      return
    }
    continueConfig.onClick()
  }

  // Pre-compute sets for efficient lookup
  const visitedSet = new Set(visitedEditableSteps)
  const editableStepsCount = customizationStepsMeta?.editableSteps ?? 0
  const visitedEditableCount = visitedEditableSteps.length
  const warningText = isOnCustomize && effectiveHasUneditedFields ? disabledGenerateReason : undefined
  const [isExpanded, setIsExpanded] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem('flow_progress_dock_expanded')
    setIsExpanded(saved === '1')
  }, [])

  const toggleExpanded = React.useCallback(() => {
    setIsExpanded(prev => {
      const next = !prev
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('flow_progress_dock_expanded', next ? '1' : '0')
      }
      return next
    })
  }, [])

  const renderCompactDots = () => {
    if (!customizationStepsMeta || editableStepsCount === 0) return null

    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: editableStepsCount }).map((_, idx) => {
          const isVisited = visitedSet.has(idx)
          return (
            <span
              key={`compact-dot-${idx}`}
              className={`h-1.5 w-1.5 rounded-full transition-colors duration-200 ${
                isVisited ? 'bg-brand-secondary' : 'bg-gray-300'
              }`}
            />
          )
        })}
      </div>
    )
  }

  const getSelfiesSummary = (): string => {
    if (selfieCount >= requiredSelfies) {
      return t('selfies.complete', { count: selfieCount })
    }
    const remaining = requiredSelfies - selfieCount
    return remaining === 1
      ? t('selfies.addOneMore')
      : t('selfies.addPhotos', { count: remaining })
  }

  const getBeautificationSummary = (): string => {
    if (!hasEnoughSelfies) {
      return t('customize.locked')
    }
    if (isOnBeautification) {
      return t('customize.inProgress')
    }
    if (isOnCustomize) {
      return t('customize.complete')
    }
    return t('customize.notStarted')
  }

  const navigateToBeautificationStep = (): void => {
    if (!hasEnoughSelfies || isOnBeautification) return
    if (isOnCustomize) {
      navigateToPreviousStep()
      return
    }
    onNavigateToCustomize()
  }

  const getGenerateSummary = (): string => {
    if (!hasEnoughSelfies) return t('generate.needPhotos')
    if (effectiveHasUneditedFields) return t('generate.needCustomization')
    if (!hasEnoughCredits) return t('generate.needCredits')
    return t('generate.ready')
  }

  // Use state to track if we're mounted (for portal)
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
  }, [])

  const continueButton = (
    <button
      type="button"
      onClick={handleContinueClick}
      disabled={continueIsHardDisabled}
      data-testid={continueConfig.isGenerate ? 'flow-dock-generate-button' : 'flow-dock-continue-button'}
      aria-disabled={continueIsHardDisabled || undefined}
      className={`
        inline-flex items-center gap-1.5 rounded-full font-semibold transition-all duration-200
        ${continueConfig.isGenerate ? 'h-8 px-3 text-xs' : 'h-9 px-4 text-sm'}
        ${continueIsDisabled
          ? 'cursor-not-allowed bg-gray-100 text-gray-400'
          : continueConfig.isGenerate
            ? 'bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-md hover:shadow-lg'
            : continueConfig.isCredits
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]'
              : 'bg-brand-primary text-white hover:brightness-110 active:brightness-95'
        }
      `}
    >
      {isGenerating ? (
        <SmallLoadingSpinner className="border-white/30 border-t-white text-white" />
      ) : continueConfig.isGenerate ? (
        <SparklesIcon className="h-3.5 w-3.5" strokeWidth={2} />
      ) : null}
      <span>{isGenerating ? t('generate.generating', { default: 'Generating...' }) : continueConfig.label}</span>
      {!continueConfig.isGenerate && !continueConfig.isCredits && !isGenerating && (
        <ChevronRightIcon className="h-4 w-4" strokeWidth={2.5} />
      )}
    </button>
  )

  const dockContent = (
    <div
      className={`
        hidden md:block
        fixed bottom-5 left-1/2 -translate-x-1/2 z-[10000]
        w-[min(92vw,760px)]
        ${className}
      `}
    >
      <div className="absolute -inset-2 rounded-3xl bg-gradient-to-b from-gray-900/[0.08] to-gray-900/[0.03] blur-2xl" />

      <div className="relative overflow-hidden rounded-2xl border-2 border-[#6F4CFF]/55 bg-white/95 backdrop-blur-xl px-3 py-2 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.22)]">
        <div className="flex h-10 items-center gap-2">
          <button
            type="button"
            onClick={backConfig.onClick}
            disabled={backConfig.disabled}
            data-testid="flow-dock-back-button"
            className={`
              inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-all duration-200
              ${backConfig.disabled
                ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-300'
                : 'border-gray-300 bg-white text-gray-700 shadow-sm hover:border-gray-400 hover:bg-gray-50 active:bg-gray-100'
              }
            `}
          >
            <ChevronLeftIcon className="h-4 w-4" strokeWidth={2.5} />
            <span>{backConfig.label}</span>
          </button>

          <div className="min-w-0 flex-1">
            {isOnCustomize ? (
              <div className="flex h-9 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50/80 px-3">
                {renderCompactDots()}
                <span className="truncate text-xs font-semibold text-gray-700">
                  {editableStepsCount > 0
                    ? t('customize.stepProgress', {
                      current: visitedEditableCount,
                      total: editableStepsCount,
                      default: `Step ${visitedEditableCount} of ${editableStepsCount}`
                    })
                    : getCustomizeStatusText()}
                </span>
                {warningText && (
                  <Tooltip content={warningText} position="top">
                    <span
                      data-testid="customization-status-banner"
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-700 cursor-help"
                    >
                      <ExclamationTriangleIcon className="h-3 w-3" />
                    </span>
                  </Tooltip>
                )}
                {onDontShowAgain && (
                  <button
                    type="button"
                    onClick={onDontShowAgain}
                    className="ml-1 shrink-0 text-[11px] font-medium text-gray-400 transition-colors hover:text-gray-600"
                  >
                    {dontShowAgainText || t('navigation.dontShowAgain', { default: "Don't show again" })}
                  </button>
                )}
              </div>
            ) : (
              <div className="flex h-9 items-center justify-center rounded-xl border border-gray-200 bg-gray-50/80 px-3">
                {onDontShowAgain && (
                  <button
                    type="button"
                    onClick={onDontShowAgain}
                    className="shrink-0 text-[11px] font-medium text-gray-400 transition-colors hover:text-gray-600"
                  >
                    {dontShowAgainText || t('navigation.dontShowAgain', { default: "Don't show again" })}
                  </button>
                )}
              </div>
            )}
          </div>

          {continueConfig.tooltip ? (
            <Tooltip content={continueConfig.tooltip} position="top">
              {continueButton}
            </Tooltip>
          ) : continueButton}

          <button
            type="button"
            onClick={toggleExpanded}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600 shadow-sm transition-all duration-200 hover:border-gray-400 hover:bg-gray-50"
            aria-label={isExpanded ? t('navigation.collapse', { default: 'Collapse details' }) : t('navigation.expand', { default: 'Expand details' })}
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <ChevronDownIcon className="h-4 w-4" strokeWidth={2.5} />
            ) : (
              <ChevronUpIcon className="h-4 w-4" strokeWidth={2.5} />
            )}
          </button>
        </div>

        {isExpanded && (
          <div className="mt-2 border-t border-gray-200/80 pt-2">
            {warningText && (
              <div
                data-testid="customization-status-banner-expanded"
                className="mb-2 rounded-lg border border-amber-200/50 bg-amber-50/80 px-2.5 py-1.5 text-center text-[11px] font-medium text-amber-700"
              >
                {warningText}
              </div>
            )}

            <div className="flex items-stretch gap-1.5">
              <button
                type="button"
                onClick={navigateToSelfieStep}
                data-testid="flow-dock-detail-step-selfies"
                className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-left transition-colors hover:bg-gray-100"
              >
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 bg-white text-[9px] font-bold text-gray-600">
                    1
                  </span>
                  <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-gray-500">{t('selfies.label')}</p>
                </div>
                <p className="mt-0.5 truncate text-[11px] font-medium text-gray-700">{getSelfiesSummary()}</p>
              </button>

              <div
                data-testid="flow-dock-detail-arrow-1"
                className="inline-flex shrink-0 items-center justify-center text-gray-400"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </div>

              <button
                type="button"
                onClick={navigateToBeautificationStep}
                disabled={!hasEnoughSelfies || isOnBeautification}
                data-testid="flow-dock-detail-step-beautification"
                className={`
                  min-w-0 flex-1 rounded-lg border px-2 py-1.5 text-left transition-colors
                  ${!hasEnoughSelfies || isOnBeautification
                    ? 'cursor-not-allowed border-gray-200 bg-gray-50'
                    : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                  }
                `}
              >
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 bg-white text-[9px] font-bold text-gray-600">
                    2
                  </span>
                  <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    {t('navigation.beautification', { default: 'Beautification' })}
                  </p>
                </div>
                <p className="mt-0.5 truncate text-[11px] font-medium text-gray-700">{getBeautificationSummary()}</p>
              </button>

              <div
                data-testid="flow-dock-detail-arrow-2"
                className="inline-flex shrink-0 items-center justify-center text-gray-400"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </div>

              <button
                type="button"
                onClick={onNavigateToCustomize}
                disabled={!hasEnoughSelfies}
                data-testid="flow-dock-detail-step-customize"
                className={`
                  min-w-0 flex-1 rounded-lg border px-2 py-1.5 text-left transition-colors
                  ${!hasEnoughSelfies
                    ? 'cursor-not-allowed border-gray-200 bg-gray-50'
                    : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                  }
                `}
              >
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 bg-white text-[9px] font-bold text-gray-600">
                    3
                  </span>
                  <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-gray-500">{t('customize.label')}</p>
                </div>
                <p className="mt-0.5 truncate text-[11px] font-medium text-gray-700">{getCustomizeStatusText()}</p>
              </button>

              <div
                data-testid="flow-dock-detail-arrow-3"
                className="inline-flex shrink-0 items-center justify-center text-gray-400"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </div>

              <div
                data-testid="flow-dock-detail-finish"
                className="w-[132px] shrink-0 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-left"
              >
                <div className="flex items-center gap-1">
                  <SparklesIcon className="h-3 w-3 text-gray-500" />
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-500">{t('generate.label')}</p>
                </div>
                <p className="mt-0.5 truncate text-[10px] font-medium text-gray-700">{getGenerateSummary()}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // Use portal to render outside of any parent stacking contexts
  if (!mounted) return null
  return createPortal(dockContent, document.body)
}
