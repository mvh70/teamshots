'use client'

import { useTranslations } from 'next-intl'

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

  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-display font-bold text-text-dark text-center mb-12">
          {t('title')}
        </h2>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <div
              key={index}
              className="relative"
            >
              {/* Connector line (hidden on mobile, shown between cards) */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-0.5 bg-gradient-to-r from-brand-primary/30 to-brand-primary/10" />
              )}

              <div className="rounded-2xl border border-bg-gray-100 bg-bg-white p-6 shadow-sm hover:shadow-md transition-shadow h-full">
                <div className="h-16 w-16 rounded-full bg-brand-primary flex items-center justify-center mb-5">
                  <span className="text-2xl font-bold text-white">{step.number}</span>
                </div>

                <h3 className="text-lg font-semibold text-text-dark mb-2">
                  {step.title}
                </h3>

                <p className="text-text-body text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
