'use client'

interface OnboardingProgressProps {
  currentStep: number
  totalSteps: number
  className?: string
}

export function OnboardingProgress({
  currentStep,
  totalSteps,
  className = ''
}: OnboardingProgressProps) {
  const progressPercentage = ((currentStep) / totalSteps) * 100

  return (
    <div className={`w-full ${className}`}>
      {/* Step indicator */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-700">
          Step {currentStep} of {totalSteps}
        </span>
        <span className="text-xs text-gray-500">
          {Math.round(progressPercentage)}% complete
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className="h-full bg-brand-primary transition-all duration-300 ease-out rounded-full"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      {/* Step dots (optional visual indicator) */}
      <div className="flex justify-between mt-3 px-1">
        {Array.from({ length: totalSteps }, (_, index) => (
          <div
            key={index}
            className={`w-2 h-2 rounded-full transition-colors duration-200 ${
              index < currentStep
                ? 'bg-brand-primary'
                : index === currentStep - 1
                ? 'bg-brand-primary/70'
                : 'bg-gray-300'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
