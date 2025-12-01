'use client'

import React from 'react'
import Image from 'next/image'

interface IntroTip {
  /** Unique key for the tip */
  key: string
  /** Icon element to display */
  icon: React.ReactNode
  /** Background color class for the icon container */
  bgColor: string
  /** Text color class for the icon */
  textColor: string
  /** Text content - either a simple string or title+description */
  content: 
    | { type: 'simple'; text: string }
    | { type: 'titled'; title: string; description: string }
}

interface IntroScreenContentProps {
  /** 'swipe' for mobile swipe flow, 'button' for desktop with continue button */
  variant: 'swipe' | 'button'
  /** Small kicker text above the title */
  kicker: string
  /** Main title */
  title: string
  /** Body text description */
  body: string
  /** Array of tips to display */
  tips: IntroTip[]
  /** Optional image to display between body and tips */
  image?: {
    src: string
    alt: string
    width: number
    height: number
    priority?: boolean
  }
  /** Text for the swipe hint (variant='swipe') */
  swipeHintText?: string
  /** Text for the continue button (variant='button') */
  continueButtonText?: string
  /** Callback when user clicks Continue (only used when variant='button') */
  onContinue?: () => void
  /** Optional additional class names */
  className?: string
}

/**
 * Generic intro screen content component that can be used for selfie tips,
 * customization intro, or other onboarding flows.
 */
export default function IntroScreenContent({ 
  variant, 
  kicker,
  title,
  body,
  tips,
  image,
  swipeHintText = 'Swipe or tap Next to continue',
  continueButtonText = 'Continue',
  onContinue,
  className = ''
}: IntroScreenContentProps) {

  return (
    <div className={`p-5 md:p-8 space-y-5 md:space-y-6 ${className}`}>
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary">
          {kicker}
        </p>
        <h3 className="text-xl md:text-2xl font-bold text-gray-900 mt-1">
          {title}
        </h3>
        <p className="text-sm md:text-base text-gray-600 mt-2 leading-relaxed">
          {body}
        </p>
      </div>

      {/* Optional Image */}
      {image && (
        <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
          <Image
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            className="w-full h-auto"
            priority={image.priority}
          />
        </div>
      )}

      {/* Tips List */}
      <div className="space-y-3 md:space-y-4">
        {tips.map((tip) => (
          <div key={tip.key} className="flex items-start gap-3 md:gap-4">
            <div className={`flex h-10 w-10 md:h-12 md:w-12 flex-shrink-0 items-center justify-center rounded-full ${tip.bgColor} ${tip.textColor}`}>
              {tip.icon}
            </div>
            <p className="text-sm md:text-base text-gray-700 pt-2">
              {tip.content.type === 'titled' ? (
                <>
                  <strong className="text-gray-900">{tip.content.title}</strong>{' '}
                  {tip.content.description}
                </>
              ) : (
                tip.content.text
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Continue button for desktop variant */}
      {variant === 'button' && (
        <div className="pt-4">
          <button
            type="button"
            onClick={onContinue}
            className="w-full px-6 py-3.5 text-base font-semibold text-white bg-gradient-to-r from-brand-primary to-indigo-600 rounded-xl shadow-lg hover:shadow-xl hover:from-brand-primary-hover hover:to-indigo-700 transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
          >
            {continueButtonText}
          </button>
        </div>
      )}
    </div>
  )
}

export type { IntroScreenContentProps, IntroTip }

