'use client'

import React from 'react'
import { createPortal } from 'react-dom'
import { CheckIcon, LockClosedIcon, SparklesIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { CheckIcon as CheckIconSolid } from '@heroicons/react/24/solid'
import { useTranslations } from 'next-intl'
import { MIN_SELFIES_REQUIRED } from '@/constants/generation'
import Tooltip from '@/components/ui/Tooltip'
import { SmallLoadingSpinner } from '@/components/ui/LoadingSpinner'
import type { CustomizationStepsMeta } from '@/lib/customizationSteps'

type StepState = 'locked' | 'incomplete' | 'active' | 'complete' | 'ready'

interface FlowProgressDockProps {
  /** Number of selfies currently selected */
  selfieCount: number
  /** Minimum selfies required (default: MIN_SELFIES_REQUIRED) */
  requiredSelfies?: number
  /** Array of unedited field names for status text */
  uneditedFields: string[]
  /** Whether there are unedited fields */
  hasUneditedFields: boolean
  /** Whether user can generate (all requirements met) */
  canGenerate: boolean
  /** Whether user has enough credits */
  hasEnoughCredits: boolean
  /** Current step in the flow */
  currentStep: 'selfies' | 'customize' | 'tips' | 'intro'
  /** Navigate to selfie selection */
  onNavigateToSelfies: () => void
  /** Navigate to customization */
  onNavigateToCustomize: () => void
  /** Trigger generation */
  onGenerate: () => void
  /** Whether generation is in progress */
  isGenerating?: boolean
  /** Additional CSS classes */
  className?: string
  /** Array of hidden screen names (e.g., ['selfie-tips', 'customization-intro']) */
  hiddenScreens?: string[]
  /** Navigate to selfie tips info page */
  onNavigateToSelfieTips?: () => void
  /** Navigate to customization intro info page */
  onNavigateToCustomizationIntro?: () => void
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
  uneditedFields,
  hasUneditedFields,
  canGenerate,
  hasEnoughCredits,
  currentStep,
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

  // Determine state for each step
  const getSelfieState = (): StepState => {
    if (hasEnoughSelfies) return 'complete'
    return 'incomplete'
  }

  const getCustomizeState = (): StepState => {
    if (!hasEnoughSelfies) return 'locked'
    if (isCustomizationComplete) return 'complete'
    return 'active'
  }

  const getGenerateState = (): StepState => {
    if (!hasEnoughSelfies) return 'locked'
    if (effectiveHasUneditedFields) return 'locked'
    if (!hasEnoughCredits) return 'locked'
    return 'ready'
  }

  const selfieState = getSelfieState()
  const customizeState = getCustomizeState()
  const generateState = getGenerateState()

  // Get status text for each step
  const getSelfieStatusText = (): string => {
    if (selfieCount === 0) {
      return t('selfies.addPhotos', { count: requiredSelfies })
    }
    if (selfieCount < requiredSelfies) {
      const remaining = requiredSelfies - selfieCount
      return remaining === 1
        ? t('selfies.addOneMore')
        : t('selfies.addPhotos', { count: remaining })
    }
    return t('selfies.complete', { count: selfieCount })
  }

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

  const getGenerateStatusText = (): string => {
    if (!hasEnoughSelfies) {
      return t('generate.needPhotos')
    }
    if (effectiveHasUneditedFields) {
      return t('generate.needCustomization')
    }
    if (!hasEnoughCredits) {
      return t('generate.needCredits')
    }
    return t('generate.ready')
  }

  // Navigation logic
  const isOnSelfies = currentStep === 'selfies' || currentStep === 'tips'
  const isOnCustomize = currentStep === 'customize' || currentStep === 'intro'

  // Back button config
  const getBackConfig = () => {
    if (isOnSelfies) {
      return {
        label: t('navigation.dashboard', { default: 'Dashboard' }),
        onClick: onNavigateToDashboard || onNavigateToSelfies,
        disabled: false
      }
    }
    if (isOnCustomize) {
      return {
        label: t('navigation.selfies', { default: 'Selfies' }),
        onClick: onNavigateToSelfies,
        disabled: false
      }
    }
    return {
      label: t('navigation.back', { default: 'Back' }),
      onClick: onNavigateToSelfies,
      disabled: false
    }
  }

  // Continue button config
  const getContinueConfig = () => {
    // On selfie-tips page, show "Selfies →" button to navigate to selfie selection
    if (currentStep === 'tips') {
      return {
        label: t('navigation.selfies', { default: 'Selfies' }),
        onClick: onNavigateToSelfies,
        disabled: false
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
    if (isOnSelfies) {
      const canContinue = hasEnoughSelfies
      return {
        label: t('navigation.customize', { default: 'Customize' }),
        onClick: onNavigateToCustomize,
        disabled: !canContinue,
        tooltip: !canContinue ? t('tooltips.needSelfies', { count: requiredSelfies }) : undefined
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
        onClick: onGenerate,
        disabled: !canContinue,
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
  const lockedSet = new Set(customizationStepsMeta?.lockedSteps ?? [])
  const visitedSet = new Set(visitedEditableSteps)

  // Render customization progress dots
  const renderCustomizationDots = () => {
    if (!customizationStepsMeta || customizationStepsMeta.editableSteps === 0) return null

    const { editableSteps, stepNames } = customizationStepsMeta

    // Check if we have valid stepNames (must be array with matching length)
    const hasValidStepNames = Array.isArray(stepNames) && stepNames.length === editableSteps

    return (
      <div className="flex items-center justify-center gap-2 mt-1">
        {Array.from({ length: editableSteps }).map((_, idx) => {
          const isVisited = visitedSet.has(idx)
          // Only show tooltip if we have valid step name
          const stepName = hasValidStepNames && stepNames[idx] ? stepNames[idx] : null

          // Wrap dot in a slightly larger hit area for better hover detection
          const dotWithHitArea = (
            <span
              className="inline-flex items-center justify-center p-1 -m-1 cursor-help"
              title={stepName || undefined}
            >
              <span
                className={`
                  block h-2 w-2 rounded-full transition-all duration-300
                  ${isVisited
                    ? 'bg-brand-secondary'
                    : 'bg-gray-300'
                  }
                `}
              />
            </span>
          )

          // Only wrap in Tooltip if we have a valid step name
          if (stepName) {
            return (
              <Tooltip key={`dot-${idx}`} content={stepName} position="top">
                {dotWithHitArea}
              </Tooltip>
            )
          }

          return <span key={`dot-${idx}`}>{dotWithHitArea}</span>
        })}
      </div>
    )
  }

  // Render a progress section (bottom row)
  const renderProgressSection = (
    label: string,
    statusText: string,
    state: StepState,
    onClick: () => void,
    isCurrent: boolean,
    showDots: boolean = false
  ) => {
    const isComplete = state === 'complete'
    const isLocked = state === 'locked'
    const isReady = state === 'ready'

    const getIconContent = () => {
      if (isLocked) {
        return <LockClosedIcon className="w-4 h-4 text-gray-300" />
      }
      if (isComplete) {
        return <CheckIconSolid className="w-4 h-4 text-white" />
      }
      if (isReady) {
        return <SparklesIcon className="w-4 h-4 text-white" />
      }
      // Active/incomplete - show empty circle handled by background
      return null
    }

    const getIconStyles = () => {
      const base = 'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200'
      if (isLocked) {
        return `${base} bg-gray-100 border border-gray-200`
      }
      if (isComplete) {
        return `${base} bg-brand-secondary`
      }
      if (isReady) {
        return `${base} bg-gradient-to-r from-brand-primary to-brand-secondary`
      }
      if (isCurrent) {
        return `${base} bg-brand-primary/20 border-2 border-brand-primary`
      }
      return `${base} bg-gray-100 border border-gray-200`
    }

    const getLabelStyles = () => {
      if (isCurrent) return 'text-gray-900 font-semibold'
      if (isComplete || isReady) return 'text-gray-600'
      if (isLocked) return 'text-gray-300'
      return 'text-gray-400'
    }

    const getStatusStyles = () => {
      if (isCurrent && isComplete) return 'text-brand-secondary'
      if (isCurrent) return 'text-brand-primary'
      if (isComplete) return 'text-gray-400'
      if (isLocked) return 'text-gray-300'
      return 'text-gray-400'
    }

    return (
      <button
        type="button"
        onClick={onClick}
        disabled={isLocked}
        className={`
          flex flex-col items-center gap-1.5 px-6 py-2 rounded-xl transition-all duration-200
          ${!isLocked ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-not-allowed'}
        `}
      >
        {/* Section label */}
        <span className={`text-xs tracking-wide uppercase ${getLabelStyles()}`}>
          {label}
        </span>

        {/* Icon */}
        <div className={getIconStyles()}>
          {getIconContent()}
        </div>

        {/* Status text */}
        <span className={`text-[10px] font-medium ${getStatusStyles()}`}>
          {statusText}
        </span>

        {/* Progress dots for customize step */}
        {showDots && renderCustomizationDots()}
      </button>
    )
  }

  // Use state to track if we're mounted (for portal)
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
  }, [])

  const dockContent = (
    <div
      className={`
        hidden md:block
        fixed bottom-8 left-1/2 -translate-x-1/2 z-[10000]
        w-auto min-w-[520px] max-w-2xl
        ${className}
      `}
    >
      {/* Soft ambient shadow for floating effect */}
      <div className="absolute -inset-3 bg-gradient-to-b from-gray-900/[0.08] to-gray-900/[0.03] rounded-[2rem] blur-2xl" />

      {/* Secondary glow layer for depth */}
      <div className="absolute -inset-1 bg-gradient-to-b from-gray-100 to-gray-200/80 rounded-3xl blur-sm opacity-60" />

      {/* Main dock container */}
      <div
        className="
          relative
          bg-gradient-to-b from-white via-white to-gray-50/90
          backdrop-blur-2xl
          rounded-2xl
          border border-gray-200/80
          shadow-[0_8px_32px_-8px_rgba(0,0,0,0.15),0_4px_12px_-4px_rgba(0,0,0,0.1)]
          px-6 py-4
          transition-all duration-300
        "
      >
        {/* ROW 1: Navigation buttons */}
        <div className="flex items-center justify-between mb-3">
          {/* Back button */}
          <button
            type="button"
            onClick={backConfig.onClick}
            disabled={backConfig.disabled}
            className={`
              flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium
              transition-all duration-200
              ${backConfig.disabled
                ? 'text-gray-300 cursor-not-allowed border border-gray-200 bg-gray-50'
                : 'text-gray-700 border border-gray-300 bg-white shadow-sm hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100'
              }
            `}
          >
            <ChevronLeftIcon className="w-4 h-4" strokeWidth={2.5} />
            <span>{backConfig.label}</span>
          </button>

          {/* Center: Don't show again (only on tips/intro pages) */}
          {onDontShowAgain && (
            <button
              type="button"
              onClick={onDontShowAgain}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              {dontShowAgainText || t('navigation.dontShowAgain', { default: "Don't show again" })}
            </button>
          )}

          {/* Continue/Generate button */}
          {continueConfig.tooltip ? (
            <Tooltip content={continueConfig.tooltip} position="top">
              <button
                type="button"
                onClick={handleContinueClick}
                disabled={continueIsHardDisabled}
                aria-disabled={continueIsHardDisabled || undefined}
                className={`
                  flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-semibold
                  transition-all duration-200
                  ${continueIsDisabled
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : continueConfig.isGenerate
                      ? 'bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]'
                      : continueConfig.isCredits
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]'
                        : 'bg-brand-primary text-white hover:brightness-110 active:brightness-95'
                  }
                `}
              >
                {isGenerating ? (
                  <SmallLoadingSpinner className="text-white border-white/30 border-t-white" />
                ) : continueConfig.isGenerate ? (
                  <SparklesIcon className="w-4 h-4" strokeWidth={2} />
                ) : null}
                <span>{continueConfig.label}</span>
                {!continueConfig.isGenerate && !continueConfig.isCredits && !isGenerating && (
                  <ChevronRightIcon className="w-4 h-4" strokeWidth={2.5} />
                )}
              </button>
            </Tooltip>
          ) : (
            <button
              type="button"
              onClick={handleContinueClick}
              disabled={continueIsHardDisabled}
              aria-disabled={continueIsHardDisabled || undefined}
              className={`
                flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-semibold
                transition-all duration-200
                ${continueIsDisabled
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : continueConfig.isGenerate
                    ? 'bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]'
                    : continueConfig.isCredits
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]'
                      : 'bg-brand-primary text-white hover:brightness-110 active:brightness-95'
                }
              `}
            >
              {isGenerating ? (
                <SmallLoadingSpinner className="text-white border-white/30 border-t-white" />
              ) : continueConfig.isGenerate ? (
                <SparklesIcon className="w-4 h-4" strokeWidth={2} />
              ) : null}
              <span>{isGenerating ? t('generate.generating', { default: 'Generating...' }) : continueConfig.label}</span>
              {!continueConfig.isGenerate && !continueConfig.isCredits && !isGenerating && (
                <ChevronRightIcon className="w-4 h-4" strokeWidth={2.5} />
              )}
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mb-3" />

        {/* Status message when customization is incomplete */}
        {isOnCustomize && effectiveHasUneditedFields && disabledGenerateReason && (
          <div data-testid="customization-status-banner" className="text-center text-xs font-medium text-amber-700 bg-amber-50/80 border border-amber-200/50 rounded-lg px-3 py-1.5 mb-3">
            {disabledGenerateReason}
          </div>
        )}

        {/* ROW 2: Progress indicators */}
        <div className="flex items-start justify-center gap-2">
          {/* SELFIES */}
          {renderProgressSection(
            t('selfies.label'),
            getSelfieStatusText(),
            selfieState,
            onNavigateToSelfies,
            isOnSelfies
          )}

          {/* Connector */}
          <div className="flex items-center self-center pt-4">
            <div className="w-8 h-[2px] bg-gray-200 rounded-full" />
          </div>

          {/* CUSTOMIZE */}
          {renderProgressSection(
            t('customize.label'),
            getCustomizeStatusText(),
            customizeState,
            onNavigateToCustomize,
            isOnCustomize,
            true // show dots
          )}

          {/* Connector */}
          <div className="flex items-center self-center pt-4">
            <div className="w-8 h-[2px] bg-gray-200 rounded-full" />
          </div>

          {/* GENERATE */}
          {renderProgressSection(
            t('generate.label'),
            getGenerateStatusText(),
            generateState,
            () => {
              if (!hasEnoughCredits && onBuyCredits) {
                onBuyCredits()
              } else if (generateState === 'ready') {
                onGenerate()
              }
            },
            false
          )}
        </div>
      </div>
    </div>
  )

  // Use portal to render outside of any parent stacking contexts
  if (!mounted) return null
  return createPortal(dockContent, document.body)
}
