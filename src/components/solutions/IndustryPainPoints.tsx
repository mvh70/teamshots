'use client'

import { useTranslations } from 'next-intl'

interface PainPointsProps {
  industry: string
}

export function IndustryPainPoints({ industry }: PainPointsProps) {
  const t = useTranslations(`solutions.${industry}.painPoints`)
  const items = t.raw('items') as Array<{ title: string; description: string }>
  const solution = t('solution')

  return (
    <section className="py-16 sm:py-20 bg-bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-display font-bold text-text-dark text-center">
          {t('title')}
        </h2>

        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {items.map((item, index) => (
            <div
              key={index}
              className="rounded-2xl border border-bg-gray-100 bg-bg-white p-8 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="h-12 w-12 rounded-full bg-brand-primary/10 flex items-center justify-center mb-6">
                <span className="text-2xl font-bold text-brand-primary">{index + 1}</span>
              </div>
              <h3 className="text-xl font-semibold text-text-dark mb-3">
                {item.title}
              </h3>
              <p className="text-text-body leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-lg font-medium text-brand-primary">
          {solution}
        </p>
      </div>
    </section>
  )
}
