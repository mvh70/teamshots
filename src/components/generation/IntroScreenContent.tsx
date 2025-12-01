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
    <div className={`p-6 md:p-10 lg:p-12 space-y-8 md:space-y-12 lg:space-y-14 ${className}`}>
      {/* Header */}
      <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <p className="text-xs md:text-sm font-semibold uppercase tracking-[0.2em] text-brand-primary opacity-95">
          {kicker}
        </p>
        <h3 className="text-3xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-[1.1] font-serif tracking-tight">
          {title}
        </h3>
        <p className="text-lg md:text-xl text-gray-600 leading-relaxed max-w-2xl">
          {body}
        </p>
      </div>

      {/* Optional Image */}
      {image && (
        <div className="rounded-2xl overflow-hidden border border-gray-200/70 shadow-2xl bg-gradient-to-br from-gray-50 via-white to-gray-50/40 ring-1 ring-gray-100/60 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100 hover:shadow-3xl transition-shadow duration-300">
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
      <div className="space-y-4 md:space-y-6">
        {tips.map((tip, index) => (
          <div 
            key={tip.key} 
            className="group relative animate-in fade-in slide-in-from-bottom-4 duration-700"
            style={{ animationDelay: `${(index + 1) * 100}ms` }}
          >
            <div className="flex items-start gap-5 md:gap-6 p-5 md:p-6 rounded-2xl bg-gradient-to-br from-white via-white to-gray-50/50 border border-gray-200/80 shadow-sm hover:shadow-2xl hover:border-gray-300/90 transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.01] backdrop-blur-sm">
              <div className={`flex h-14 w-14 md:h-16 md:w-16 flex-shrink-0 items-center justify-center rounded-xl border-2 border-white/90 shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:shadow-2xl group-hover:rotate-3 group-hover:border-white ${tip.bgColor} ${tip.textColor}`}>
                {tip.icon}
              </div>
              <div className="flex-1 pt-1 md:pt-2.5">
                {tip.content.type === 'titled' ? (
                  <div className="space-y-2.5">
                    <h4 className="text-lg md:text-xl font-bold text-gray-900 leading-tight tracking-tight">
                      {tip.content.title}
                    </h4>
                    <p className="text-base md:text-lg text-gray-600 leading-relaxed">
                      {tip.content.description}
                    </p>
                  </div>
                ) : (
                  <p className="text-base md:text-lg text-gray-700 leading-relaxed font-medium">
                    {tip.content.text}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Continue button for desktop variant */}
      {variant === 'button' && (
        <div className="pt-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          <button
            type="button"
            onClick={onContinue}
            className="w-full px-8 py-4 text-base font-semibold text-white bg-gradient-to-r from-brand-primary via-brand-primary to-indigo-600 rounded-xl shadow-lg hover:shadow-2xl hover:from-brand-primary-hover hover:via-brand-primary-hover hover:to-indigo-700 transform hover:-translate-y-1 active:translate-y-0 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
          >
            {continueButtonText}
          </button>
        </div>
      )}
    </div>
  )
}

export type { IntroScreenContentProps, IntroTip }

