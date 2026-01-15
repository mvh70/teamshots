'use client'

import { useTranslations } from 'next-intl'
import { ShieldCheckIcon } from '@heroicons/react/24/outline'

interface GuaranteeProps {
  locale: string
}

export function IndustryGuarantee({ locale }: GuaranteeProps) {
  // Use the teamshotspro landing guarantee translations
  const t = useTranslations('landing.teamshotspro.guarantee')

  return (
    <section className="py-16 sm:py-20 lg:py-24 bg-gradient-to-br from-brand-primary-light via-bg-white to-brand-secondary-light">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="bg-white rounded-3xl shadow-depth-2xl p-8 sm:p-12 border-4 border-brand-primary">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-brand-primary to-brand-primary-hover rounded-full mb-6 shadow-depth-xl">
            <ShieldCheckIcon className="w-10 h-10 text-white" />
          </div>

          <h3 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-text-dark mb-6">
            {t('title')}
          </h3>

          <p className="text-lg sm:text-xl text-text-body leading-relaxed mb-4">
            {t('subtitle')}
          </p>

          <p className="text-base sm:text-lg text-text-muted max-w-2xl mx-auto">
            {t('description')}
          </p>

          {/* Guarantee Points */}
          <div className="mt-8 grid sm:grid-cols-3 gap-6">
            <div className="flex flex-col items-center p-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h4 className="font-bold text-text-dark mb-1">
                {locale === 'es' ? 'Regeneraciones ilimitadas' : 'Unlimited Regenerations'}
              </h4>
              <p className="text-sm text-text-muted">
                {locale === 'es' ? 'Hasta que estés satisfecho' : 'Until you\'re satisfied'}
              </p>
            </div>

            <div className="flex flex-col items-center p-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h4 className="font-bold text-text-dark mb-1">
                {locale === 'es' ? 'Devolución de dinero' : 'Money-Back Guarantee'}
              </h4>
              <p className="text-sm text-text-muted">
                {locale === 'es' ? 'Sin preguntas' : 'No questions asked'}
              </p>
            </div>

            <div className="flex flex-col items-center p-4">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h4 className="font-bold text-text-dark mb-1">
                {locale === 'es' ? 'Datos seguros' : 'Data Security'}
              </h4>
              <p className="text-sm text-text-muted">
                {locale === 'es' ? 'Encriptación de extremo a extremo' : 'End-to-end encryption'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
