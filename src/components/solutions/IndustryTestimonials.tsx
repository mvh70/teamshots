'use client'

import Image from 'next/image'
import { useTranslations, useLocale } from 'next-intl'
import { CheckBadgeIcon } from '@heroicons/react/24/solid'
import { getFeaturedTransformations, type FeaturedTransformation } from '@/config/social-proof'

interface TestimonialsProps {
  industry: string
}

export function IndustryTestimonials({ industry }: TestimonialsProps) {
  // Temporarily disabled until we have real verified testimonials
  // To re-enable: remove this return statement and uncomment the section below
  return null

  /*
  const t = useTranslations(`solutions.${industry}.testimonials`)
  const locale = useLocale()

  // Get verified transformations from social-proof config
  const transformations = getFeaturedTransformations()

  // If no verified transformations, don't render the section
  if (transformations.length === 0) {
    return null
  }

  return (
    <section className="py-16 sm:py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-text-dark mb-4">
            {t('title')}
          </h2>
          <p className="text-text-muted flex items-center justify-center gap-2">
            <CheckBadgeIcon className="w-5 h-5 text-blue-500" />
            <span>{locale === 'es' ? 'Verificado vía LinkedIn' : 'Verified via LinkedIn'}</span>
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {transformations.map((person) => (
            <TransformationCard key={person.id} person={person} locale={locale} />
          ))}
        </div>
      </div>
    </section>
  )
  */
}

interface TransformationCardProps {
  person: FeaturedTransformation
  locale: string
}

function TransformationCard({ person, locale }: TransformationCardProps) {
  const role = locale === 'es' && person.roleEs ? person.roleEs : person.role

  return (
    <div className="rounded-2xl border border-bg-gray-100 bg-bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Before/After Images */}
      <div className="relative aspect-[4/3] bg-gray-100">
        <div className="absolute inset-0 grid grid-cols-2">
          <div className="relative">
            <Image
              src={person.beforeImage}
              alt={`${person.name} before`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 45vw, 200px"
            />
            <span className="absolute top-2 left-2 bg-brand-cta text-white px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
              Before
            </span>
          </div>
          <div className="relative">
            <Image
              src={person.afterImage}
              alt={`${person.name} after`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 45vw, 200px"
            />
            <span className="absolute top-2 right-2 bg-brand-secondary text-white px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
              After
            </span>
          </div>
        </div>
      </div>

      {/* Person Info */}
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-text-dark flex items-center gap-1.5">
              {person.name}
              {person.isFounder && (
                <span className="text-[10px] bg-brand-primary/10 text-brand-primary px-1.5 py-0.5 rounded-full font-medium">
                  {locale === 'es' ? 'Fundador' : 'Founder'}
                </span>
              )}
            </p>
            <p className="text-sm text-text-muted">
              {role}
              {person.company && (
                <>
                  {' '}
                  {locale === 'es' ? 'en' : 'at'}{' '}
                  {person.companyUrl ? (
                    <a
                      href={person.companyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-primary hover:underline"
                    >
                      {person.company}
                    </a>
                  ) : (
                    person.company
                  )}
                </>
              )}
            </p>
          </div>

          {/* LinkedIn Verification Badge */}
          <a
            href={person.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors"
            title={locale === 'es' ? 'Verificar en LinkedIn' : 'Verify on LinkedIn'}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
            <CheckBadgeIcon className="w-3.5 h-3.5 text-blue-500" />
          </a>
        </div>
      </div>
    </div>
  )
}
