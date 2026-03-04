'use client'

import { useTranslations } from 'next-intl'
import ThreeSplitFlowProgress from './ThreeSplitFlowProgress'

interface StandardThreeStepIndicatorProps {
  currentIndex: number
  totalSteps: number
  visitedSteps?: number[]
  lockedSteps?: number[]
  className?: string
}

export default function StandardThreeStepIndicator({
  currentIndex,
  totalSteps,
  visitedSteps,
  lockedSteps,
  className = '',
}: StandardThreeStepIndicatorProps) {
  const tNav = useTranslations('generation.progressDock.navigation')

  return (
    <ThreeSplitFlowProgress
      className={className}
      selfieLabel={tNav('selfies', { default: 'Selfies' })}
      beautificationLabel={tNav('beautification', { default: 'Beautification' })}
      customizeLabel={tNav('customize', { default: 'Customize' })}
      currentIndex={currentIndex}
      totalSteps={totalSteps}
      visitedSteps={visitedSteps}
      lockedSteps={lockedSteps}
    />
  )
}
