'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight } from 'lucide-react'

interface FinalCTAProps {
  industry: string
  locale: string
}

export function IndustryFinalCTA({ industry, locale }: FinalCTAProps) {
  const t = useTranslations(`solutions.${industry}.finalCta`)

  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-br from-brand-primary to-brand-primary-hover p-10 sm:p-14 text-center shadow-xl">
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-white mb-4">
            {t('title')}
          </h2>

          <p className="text-lg text-white/80 mb-8 max-w-xl mx-auto">
            {t('subtitle')}
          </p>

          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-brand-primary font-semibold hover:bg-bg-gray-50 transition-colors shadow-lg"
          >
            {t('cta')}
            <ArrowRight className="h-5 w-5" />
          </Link>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-white/70 text-sm">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-white/50" />
              {locale === 'es' ? 'Sin tarjeta de crédito' : 'No credit card required'}
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-white/50" />
              {locale === 'es' ? 'Configuración en 60 segundos' : '60-second setup'}
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-white/50" />
              {locale === 'es' ? 'Garantía 100% humano' : '100% Human-Look Guarantee'}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
