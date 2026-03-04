'use client'

import React from 'react'
import { LockClosedIcon } from '@heroicons/react/24/outline'

interface ThreeSplitFlowProgressProps {
  selfieLabel: string
  beautificationLabel: string
  customizeLabel: string
  currentIndex: number
  totalSteps: number
  visitedSteps?: number[]
  lockedSteps?: number[]
  className?: string
}

function Dot({
  colorClass,
  isCurrent = false,
}: {
  colorClass: string
  isCurrent?: boolean
}) {
  return (
    <span
      className={`rounded-full transition-all duration-300 ${isCurrent ? 'h-3 w-3' : 'h-2.5 w-2.5'} ${colorClass}`}
    />
  )
}

function StepDot({
  index,
  currentIndex,
  visitedSet,
}: {
  index: number
  currentIndex: number
  visitedSet: Set<number>
}) {
  const isCurrent = currentIndex === index
  const isVisited = visitedSet.has(index)

  if (isVisited) {
    return <Dot colorClass="bg-brand-secondary" isCurrent={isCurrent} />
  }
  if (isCurrent) {
    return <Dot colorClass="bg-brand-primary" isCurrent />
  }
  return <Dot colorClass="bg-gray-300" />
}

export default function ThreeSplitFlowProgress({
  selfieLabel,
  beautificationLabel,
  customizeLabel,
  currentIndex,
  totalSteps,
  visitedSteps = [],
  lockedSteps = [],
  className = '',
}: ThreeSplitFlowProgressProps) {
  const visitedSet = new Set(visitedSteps)
  const lockedSet = new Set(lockedSteps)
  const customizationIndices = Array.from(
    { length: Math.max(totalSteps - 2, 0) },
    (_, idx) => idx + 2
  )

  return (
    <div data-testid="flow-step-indicator" className={`flex items-center justify-center gap-4 ${className}`}>
      <div data-testid="flow-step-selfies" className="flex items-center gap-1.5">
        <span className="text-xs text-gray-500 font-medium">{selfieLabel}</span>
        <StepDot index={0} currentIndex={currentIndex} visitedSet={visitedSet} />
      </div>

      <div className="h-4 w-px bg-gray-200" />

      <div data-testid="flow-step-beautification" className="flex items-center gap-1.5">
        <span className="text-xs text-gray-500 font-medium">{beautificationLabel}</span>
        <StepDot index={1} currentIndex={currentIndex} visitedSet={visitedSet} />
      </div>

      <div className="h-4 w-px bg-gray-200" />

      <div data-testid="flow-step-customize" className="flex items-center gap-1.5">
        <span className="text-xs text-gray-500 font-medium">{customizeLabel}</span>
        <div data-testid="flow-step-customize-dots" className="flex items-center gap-1">
          {customizationIndices.map((idx) => {
            const isCurrent = currentIndex === idx
            if (lockedSet.has(idx)) {
              return (
                <LockClosedIcon
                  key={`split-lock-${idx}`}
                  className={`h-3 w-3 ${isCurrent ? 'text-gray-600' : 'text-gray-400'}`}
                />
              )
            }
            return (
              <StepDot
                key={`split-dot-${idx}`}
                index={idx}
                currentIndex={currentIndex}
                visitedSet={visitedSet}
              />
            )
          })}
          {customizationIndices.length === 0 && <Dot colorClass="bg-gray-300" />}
        </div>
      </div>
    </div>
  )
}
