'use client'

import React from 'react'
import { createPortal } from 'react-dom'
import { CheckIcon, LockClosedIcon, InformationCircleIcon, SparklesIcon, PlusIcon } from '@heroicons/react/24/outline'
import { CheckIcon as CheckIconSolid } from '@heroicons/react/24/solid'
import { useTranslations } from 'next-intl'
import { MIN_SELFIES_REQUIRED } from '@/constants/generation'
import Tooltip from '@/components/ui/Tooltip'
import { SmallLoadingSpinner } from '@/components/ui/LoadingSpinner'

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
  /** Action to buy credits */
  onBuyCredits?: () => void
  /** Customization steps metadata for progress dots */
  customizationStepsMeta?: {
    /** Total number of editable steps */
    editableSteps: number
    /** Total number of all steps (editable + locked) */
    allSteps: number
    /** Indices of locked steps */
    lockedSteps: number[]
  }
  /** Indices of visited/completed editable steps */
  visitedEditableSteps?: number[]
}

/**
 * Desktop-only progress dock for the generation flow.
 * Shows 3 steps: Selfies → Customize → Generate
 *
 * Extends patterns from FlowNavigation and StepIndicator.
 * Positioned fixed at bottom center of screen.
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
  onBuyCredits,
  isGenerating = false,
  className = '',
  hiddenScreens = [],
  onNavigateToSelfieTips,
  onNavigateToCustomizationIntro,
  customizationStepsMeta,
  visitedEditableSteps = []
}: FlowProgressDockProps) {
  const t = useTranslations('generation.progressDock')

  const hasEnoughSelfies = selfieCount >= requiredSelfies

  // Compute if customization is complete based on visited steps
  // If all editable steps have been visited, customization is considered complete
  const isCustomizationComplete = customizationStepsMeta
    ? visitedEditableSteps.length >= customizationStepsMeta.editableSteps && customizationStepsMeta.editableSteps > 0
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
    // Show as complete if customization is done (all editable steps visited)
    if (isCustomizationComplete) {
      return 'complete'
    }
    // If not on customize page and no visited steps, show as active (not started yet)
    if (currentStep !== 'customize' && visitedEditableSteps.length === 0) {
      return 'active'
    }
    return 'active'
  }

  const getGenerateState = (): StepState => {
    if (!hasEnoughSelfies) return 'locked'
    if (effectiveHasUneditedFields) return 'locked'
    if (!hasEnoughCredits) return 'locked'
    // All basic requirements met - show as ready
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
    // Show remaining fields only when on customize page
    if (currentStep === 'customize' && uneditedFields.length > 0) {
      // Format field names for display (e.g., "clothingColors" -> "colors")
      const displayNames = uneditedFields.map(field => {
        if (field === 'clothingColors') return t('fields.colors', { default: 'colors' })
        if (field === 'shotType') return t('fields.shotType', { default: 'shot' })
        return t(`fields.${field}`, { default: field })
      })
      const fieldsText = displayNames.slice(0, 3).join(', ')
      return t('customize.remaining', { fields: fieldsText })
    }
    // Check if customization is complete based on visited steps
    if (isCustomizationComplete) {
      return t('customize.complete')
    }
    // If no visited steps, customization hasn't started yet
    if (visitedEditableSteps.length === 0) {
      return t('customize.notStarted', { default: 'Customize your photos' })
    }
    // In progress - some steps visited but not all
    return t('customize.inProgress', { default: 'In progress' })
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

  const getTooltipText = (state: StepState, step: 'selfies' | 'customize' | 'generate'): string | undefined => {
    if (state !== 'locked') return undefined

    if (step === 'customize') {
      return t('tooltips.needSelfies', { count: requiredSelfies })
    }
    if (step === 'generate') {
      if (!hasEnoughSelfies) return t('tooltips.needSelfies', { count: requiredSelfies })
      if (effectiveHasUneditedFields) return t('tooltips.needCustomization')
      if (!hasEnoughCredits) return t('tooltips.needCredits')
    }
    return undefined
  }

  // Check if info screens are hidden
  const isSelfieTipsHidden = hiddenScreens.includes('selfie-tips')
  const isCustomizationIntroHidden = hiddenScreens.includes('customization-intro')

  // Pre-compute sets for efficient lookup
  const lockedSet = new Set(customizationStepsMeta?.lockedSteps ?? [])
  const visitedSet = new Set(visitedEditableSteps)

  // Render customization progress dots
  const renderCustomizationDots = () => {
    if (!customizationStepsMeta || customizationStepsMeta.allSteps === 0) return null

    const { allSteps } = customizationStepsMeta

    return (
      <div className="flex items-center justify-center gap-1.5">
        {Array.from({ length: allSteps }).map((_, idx) => {
          const isLocked = lockedSet.has(idx)
          const isVisited = visitedSet.has(idx)

          if (isLocked) {
            // Locked steps show a tiny lock icon
            return (
              <div
                key={`dot-lock-${idx}`}
                className="w-2 h-2 rounded-full bg-gray-200 flex items-center justify-center"
              >
                <LockClosedIcon className="h-1.5 w-1.5 text-gray-400" />
              </div>
            )
          }

          // Editable steps: green if visited, subtle gray with brand ring if not
          return (
            <span
              key={`dot-${idx}`}
              className={`
                h-2 w-2 rounded-full transition-all duration-300
                ${isVisited
                  ? 'bg-brand-secondary shadow-[0_0_0_2px_rgba(16,185,129,0.2)]'
                  : 'bg-gray-300 hover:bg-brand-primary-light'
                }
              `}
            />
          )
        })}
      </div>
    )
  }

  // Render info icon with optional diagonal line when hidden
  const renderInfoIcon = (
    isHidden: boolean,
    onClick: (() => void) | undefined,
    tooltipText: string
  ) => {
    if (!onClick) return null

    const iconContent = (
      <button
        type="button"
        onClick={onClick}
        className={`
          relative flex items-center justify-center w-8 h-8 rounded-full
          transition-all duration-200 group flex-shrink-0
          ${isHidden
            ? 'bg-gray-50 hover:bg-gray-100'
            : 'bg-brand-primary-light hover:bg-brand-primary-lighter hover:scale-105'
          }
        `}
        aria-label={tooltipText}
      >
        <InformationCircleIcon
          className={`w-4.5 h-4.5 transition-all duration-200 ${
            isHidden
              ? 'text-gray-400 group-hover:text-gray-500'
              : 'text-brand-primary group-hover:text-brand-primary-hover'
          }`}
          style={{ width: '18px', height: '18px' }}
        />
        {isHidden && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            aria-hidden="true"
          >
            <div className="w-5 h-0.5 bg-gray-400 -rotate-45 rounded-full opacity-60" />
          </div>
        )}
      </button>
    )

    return (
      <Tooltip content={tooltipText} position="top">
        {iconContent}
      </Tooltip>
    )
  }

  // Handle step clicks
  const handleSelfieClick = () => {
    onNavigateToSelfies()
  }

  const handleCustomizeClick = () => {
    if (customizeState === 'locked') return
    onNavigateToCustomize()
  }

  const handleGenerateClick = () => {
    if (!hasEnoughCredits && onBuyCredits) {
      onBuyCredits()
      return
    }
    if (generateState !== 'ready') return
    onGenerate()
  }

  // Render a step
  const renderStep = (
    label: string,
    statusText: string,
    state: StepState,
    onClick: () => void,
    isCurrentStep: boolean,
    tooltipText?: string,
    stepNumber?: number
  ) => {
    const isClickable = state !== 'locked'
    const isComplete = state === 'complete'
    const isReady = state === 'ready'
    const isLocked = state === 'locked'
    const isGenerateStep = stepNumber === 3

    // Special rendering for Generate button when ready OR when credits are needed
    if (isGenerateStep && (isReady || state === 'active' || state === 'locked' || (!hasEnoughCredits && onBuyCredits))) {
      // If it's the generate step, render a prominent button
      const getGenerateButtonStyles = () => {
        const base = 'flex items-center gap-2 px-6 py-2.5 rounded-full transition-all duration-300 font-semibold shadow-lg'
        
        // Buy Credits State
        if (!hasEnoughCredits && onBuyCredits) {
           return `${base} bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.02] active:scale-[0.98] ring-offset-2 ring-amber-500`
        }

        if (isLocked) {
          return `${base} bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed`
        }
        if (isGenerating) {
          return `${base} bg-brand-primary text-white cursor-wait opacity-90`
        }
        if (isReady) {
          return `${base} bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-brand-primary/25 hover:shadow-brand-primary/40 hover:scale-[1.02] active:scale-[0.98] ring-offset-2 ring-brand-primary`
        }
        return `${base} bg-white border border-gray-200 text-gray-400`
      }

      const buttonContent = (
        <button
          type="button"
          onClick={onClick}
          disabled={(!isReady && !isGenerating && !(!hasEnoughCredits && onBuyCredits)) || (isGenerating && true)}
          className={getGenerateButtonStyles()}
        >
          {isGenerating ? (
            <SmallLoadingSpinner className="text-white border-white/30 border-t-white" />
          ) : !hasEnoughCredits && onBuyCredits ? (
             <PlusIcon className="w-5 h-5" strokeWidth={2.5} />
          ) : (
            <SparklesIcon className={`w-5 h-5 ${isReady ? 'animate-pulse' : ''}`} strokeWidth={2} />
          )}
          <span>
            {isGenerating 
              ? t('generate.generating', { default: 'Generating...' }) 
              : !hasEnoughCredits && onBuyCredits
                ? t('generate.buyCredits', { default: 'Buy Credits' })
                : label
            }
          </span>
        </button>
      )

       if (tooltipText && isLocked && hasEnoughCredits) {
        return (
          <Tooltip content={tooltipText} position="top">
            {buttonContent}
          </Tooltip>
        )
      }
      return buttonContent
    }

    // Enhanced circle styles with rings and depth
    const getCircleStyles = () => {
      const base = 'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300'

      if (isLocked) {
        return `${base} bg-gray-50 text-gray-300 border border-gray-200`
      }
      if (isComplete) {
        return `${base} bg-brand-secondary text-white shadow-[0_2px_8px_rgba(16,185,129,0.25)] border border-brand-secondary`
      }
      if (isCurrentStep) {
        return `${base} bg-brand-primary text-white shadow-[0_2px_12px_rgba(99,102,241,0.3)] border border-brand-primary ring-2 ring-brand-primary/20 ring-offset-2`
      }
      // Active but not current (e.g. visited but moved back)
      return `${base} bg-white text-gray-500 border border-gray-200 hover:border-brand-primary-light hover:bg-gray-50`
    }

    // Label styles with better hierarchy
    const getLabelStyles = () => {
      const base = 'text-sm font-medium tracking-tight transition-colors duration-200'
      if (isLocked) return `${base} text-gray-300`
      if (isCurrentStep) return `${base} text-gray-900`
      if (isComplete) return `${base} text-gray-700`
      return `${base} text-gray-500`
    }

    // Status text styles
    const getStatusStyles = () => {
      const base = 'text-[10px] leading-tight font-medium transition-colors duration-200'
      if (isComplete) return `${base} text-brand-secondary`
      if (isLocked) return `${base} text-gray-300`
      if (isCurrentStep) return `${base} text-brand-primary`
      return `${base} text-gray-400`
    }

    const stepContent = (
      <button
        type="button"
        onClick={onClick}
        disabled={!isClickable}
        className={`
          flex items-center gap-3 px-3 py-2 rounded-xl
          transition-all duration-200 group relative
          ${isClickable
            ? 'cursor-pointer hover:bg-gray-50'
            : 'cursor-not-allowed'
          }
        `}
      >
        {/* Circle indicator */}
        <div className={getCircleStyles()}>
          {isLocked ? (
            <LockClosedIcon className="w-3.5 h-3.5" strokeWidth={2} />
          ) : isComplete ? (
            <CheckIconSolid className="w-4 h-4" />
          ) : (
            <span className="text-xs font-bold">{stepNumber}</span>
          )}
        </div>

        <div className="flex flex-col items-start gap-0.5 min-w-[80px]">
          {/* Label */}
          <span className={getLabelStyles()}>
            {label}
          </span>

          {/* Status text */}
          <span className={getStatusStyles()}>
            {statusText}
          </span>
        </div>
      </button>
    )

    if (tooltipText && isLocked) {
      return (
        <Tooltip content={tooltipText} position="top">
          {stepContent}
        </Tooltip>
      )
    }

    return stepContent
  }

  // Render connecting line with gradient progress
  const renderLine = (fromState: StepState, toState: StepState) => {
    const isActive = fromState === 'complete' && toState !== 'locked'
    const isPartial = fromState === 'complete' || fromState === 'active'

    // Don't render line if it goes to Generate step (since that's now a distinct button)
    // Actually, we might still want a small line or gap?
    // Let's keep a subtle line but shorter
    return (
      <div className="w-8 flex items-center justify-center px-1">
        <div className="relative w-full h-0.5 rounded-full overflow-hidden bg-gray-100">
          <div
            className={`
              absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out
              ${isActive
                ? 'w-full bg-brand-secondary'
                : isPartial
                  ? 'w-1/2 bg-gradient-to-r from-brand-secondary to-transparent'
                  : 'w-0'
              }
            `}
          />
        </div>
      </div>
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
        w-auto min-w-[500px] max-w-3xl
        ${className}
      `}
    >
      {/* Soft ambient shadow for floating effect */}
      <div className="absolute -inset-3 bg-gradient-to-b from-gray-900/[0.08] to-gray-900/[0.03] rounded-[2rem] blur-2xl" />

      {/* Secondary glow layer for depth */}
      <div className="absolute -inset-1 bg-gradient-to-b from-gray-100 to-gray-200/80 rounded-full blur-sm opacity-60" />

      {/* Main dock container */}
      <div
        className="
          relative
          bg-gradient-to-b from-gray-50 via-white to-gray-50/90
          backdrop-blur-2xl
          rounded-full
          border border-gray-200/80
          shadow-[0_8px_32px_-8px_rgba(0,0,0,0.15),0_4px_12px_-4px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-1px_0_rgba(0,0,0,0.05)]
          px-8 py-3
          transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]
          hover:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.2),0_6px_16px_-4px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,1),inset_0_-1px_0_rgba(0,0,0,0.05)]
          hover:border-gray-300/90
          hover:scale-[1.008]
        "
      >
        {/* Top highlight line */}
        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-gray-300/60 to-transparent" />

        {/* Subtle brand accent at bottom */}
        <div className="absolute inset-x-12 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-brand-primary/20 to-transparent rounded-full" />

        <div className="flex items-center justify-between gap-4">
          {/* Info icon: Selfie Tips (before Selfies step) */}
          {onNavigateToSelfieTips && (
            <div className="flex items-center">
              {renderInfoIcon(
                isSelfieTipsHidden,
                onNavigateToSelfieTips,
                t('infoIcons.selfieTips', { default: 'Selfie tips' })
              )}
              {/* Small spacing instead of connector */}
              <div className="w-2" />
            </div>
          )}

          {/* Step 1: Selfies */}
          {renderStep(
            t('selfies.label'),
            getSelfieStatusText(),
            selfieState,
            handleSelfieClick,
            currentStep === 'selfies' || currentStep === 'tips',
            undefined,
            1
          )}

          {/* Line 1 */}
          {renderLine(selfieState, customizeState)}

          {/* Info icon: Customization Intro (before Customize step) */}
          {onNavigateToCustomizationIntro && (
            <div className="flex items-center px-1">
              {renderInfoIcon(
                isCustomizationIntroHidden,
                onNavigateToCustomizationIntro,
                t('infoIcons.customizationIntro', { default: 'Customization guide' })
              )}
            </div>
          )}

          {/* Step 2: Customize with progress dots */}
          <div className="flex flex-col items-center gap-1">
            {renderStep(
              t('customize.label'),
              getCustomizeStatusText(),
              customizeState,
              handleCustomizeClick,
              currentStep === 'customize' || currentStep === 'intro',
              getTooltipText(customizeState, 'customize'),
              2
            )}
            {renderCustomizationDots()}
          </div>

          {/* Line 2 - Only show if not just a button next */}
          {renderLine(customizeState, generateState)}

          {/* Step 3: Generate */}
          {renderStep(
            t('generate.label'),
            getGenerateStatusText(),
            generateState,
            handleGenerateClick,
            false,
            getTooltipText(generateState, 'generate'),
            3
          )}
        </div>
      </div>
    </div>
  )

  // Use portal to render outside of any parent stacking contexts
  // This ensures fixed positioning works correctly
  if (!mounted) return null
  return createPortal(dockContent, document.body)
}
