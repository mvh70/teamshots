'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'

// Auto-advance interval in milliseconds
const AUTO_ADVANCE_INTERVAL = 5000
// Pause duration after user interaction before resuming auto-advance
const PAUSE_AFTER_INTERACTION = 10000

interface HowItWorksProps {
  industry: string
}

export function IndustryHowItWorks({ industry }: HowItWorksProps) {
  const t = useTranslations(`solutions.${industry}.howItWorks`)
  const steps = t.raw('steps') as Array<{
    number: string
    title: string
    description: string
  }>

  const [activeStep, setActiveStep] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const sectionRef = useRef<HTMLElement>(null)

  // Handle user interaction - pause auto-advance temporarily
  const handleUserInteraction = useCallback((stepIndex: number) => {
    setActiveStep(stepIndex)
    setIsPaused(true)

    // Clear any existing timeout
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current)
    }

    // Resume auto-advance after pause duration
    pauseTimeoutRef.current = setTimeout(() => {
      setIsPaused(false)
    }, PAUSE_AFTER_INTERACTION)
  }, [])

  // Intersection observer for visibility
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
      },
      { threshold: 0.15 }
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [])

  // Auto-advance effect
  useEffect(() => {
    if (!isVisible || isPaused) return

    const interval = setInterval(() => {
      setActiveStep(current => {
        const nextStep = current >= steps.length - 1 ? 0 : current + 1
        return nextStep
      })
    }, AUTO_ADVANCE_INTERVAL)

    return () => clearInterval(interval)
  }, [isVisible, isPaused, steps.length])

  // Cleanup pause timeout on unmount
  useEffect(() => {
    return () => {
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current)
      }
    }
  }, [])

  return (
    <section ref={sectionRef} className="py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-display font-bold text-text-dark text-center mb-12">
          {t('title')}
        </h2>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <button
              key={index}
              onClick={() => handleUserInteraction(index)}
              className="relative text-left focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 rounded-2xl"
            >
              {/* Connector line (hidden on mobile, shown between cards) */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-0.5 bg-gradient-to-r from-brand-primary/30 to-brand-primary/10" />
              )}

              <div className={`rounded-2xl border bg-bg-white p-6 shadow-sm transition-all duration-300 h-full ${
                activeStep === index
                  ? 'border-brand-primary shadow-md ring-2 ring-brand-primary/20'
                  : 'border-bg-gray-100 hover:shadow-md hover:border-brand-primary/30'
              }`}>
                <div className={`h-16 w-16 rounded-full flex items-center justify-center mb-5 transition-colors duration-300 ${
                  activeStep === index ? 'bg-brand-primary' : 'bg-brand-primary/80'
                }`}>
                  <span className="text-2xl font-bold text-white">{step.number}</span>
                </div>

                <h3 className="text-lg font-semibold text-text-dark mb-2">
                  {step.title}
                </h3>

                <p className="text-text-body text-sm leading-relaxed">
                  {step.description}
                </p>

                {/* Progress indicator */}
                {activeStep === index && !isPaused && (
                  <div className="mt-4 h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-primary rounded-full animate-progress"
                      style={{
                        animation: `progress ${AUTO_ADVANCE_INTERVAL}ms linear`
                      }}
                    />
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* CSS for progress animation */}
      <style jsx>{`
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </section>
  )
}
