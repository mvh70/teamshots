'use client'

import { useTranslations } from 'next-intl'
import { Quote } from 'lucide-react'

interface TestimonialsProps {
  industry: string
}

export function IndustryTestimonials({ industry }: TestimonialsProps) {
  const t = useTranslations(`solutions.${industry}.testimonials`)
  const items = t.raw('items') as Array<{
    quote: string
    author: string
    role: string
    company: string
  }>

  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-display font-bold text-text-dark text-center mb-12">
          {t('title')}
        </h2>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <div
              key={index}
              className="rounded-2xl border border-bg-gray-100 bg-bg-white p-8 shadow-sm hover:shadow-md transition-shadow"
            >
              <Quote className="h-8 w-8 text-brand-primary/30 mb-4" />

              <p className="text-text-dark text-lg leading-relaxed mb-6">
                "{item.quote}"
              </p>

              <div className="border-t border-bg-gray-100 pt-4">
                <p className="font-semibold text-text-dark">{item.author}</p>
                <p className="text-sm text-text-muted">
                  {item.role} at {item.company}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
