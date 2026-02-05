'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ShieldCheckIcon, ClockIcon, BanknotesIcon } from '@heroicons/react/24/outline'
import type { SolutionConfig } from '@/config/solutions'
import BeforeAfterSlider from '@/components/BeforeAfterSlider'

interface HeroProps {
  industry: string
  solution: SolutionConfig
  locale: string
}

export function IndustryHero({ industry, solution, locale }: HeroProps) {
  const t = useTranslations(`solutions.${industry}.hero`)
  const tTrust = useTranslations('landing.teamshotspro.hero.trustBadges')

  return (
    <section className="py-8 sm:py-10 lg:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-bg-gray-100 bg-bg-white shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/5 via-transparent to-brand-primary-hover/5 pointer-events-none" />

          {/* FORCE-REBUILD-MARKER */}
          <div className="grid gap-8 lg:gap-10 lg:grid-cols-2 p-6 sm:p-8 lg:p-10 relative items-center">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-brand-primary mb-4">
            <span className="h-2 w-2 rounded-full bg-brand-primary" aria-hidden="true" />
            {t('badge')}
          </p>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-extrabold tracking-tight text-text-dark leading-[1.05]">
            {t('title')}
          </h1>

          <p className="mt-5 text-lg sm:text-xl text-text-body leading-relaxed max-w-2xl">
            {t('subtitle')}
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              href="/auth/signup"
              className="inline-flex justify-center items-center rounded-xl bg-brand-cta px-6 py-4 text-white font-semibold hover:bg-brand-cta-hover transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {t('cta')}
            </Link>
            <Link
              href="/pricing"
              className="inline-flex justify-center items-center rounded-xl border border-bg-gray-100 bg-bg-white px-6 py-4 text-text-dark font-semibold hover:border-brand-primary/40 hover:shadow-sm transition-all"
            >
              {locale === 'es' ? 'Ver precios' : 'See pricing'}
            </Link>
          </div>

          {/* Social Proof Stack */}
          <div className="mt-6 flex items-center gap-4">
            {/* User Avatars */}
            <div className="flex -space-x-2">
              <Image src="/images/avatars/avatar-1.jpeg" alt="User" width={36} height={36} className="w-9 h-9 rounded-full border-2 border-white shadow-sm object-cover" />
              <Image src="/images/avatars/avatar-2.jpeg" alt="User" width={36} height={36} className="w-9 h-9 rounded-full border-2 border-white shadow-sm object-cover" />
              <Image src="/images/avatars/avatar-3.jpeg" alt="User" width={36} height={36} className="w-9 h-9 rounded-full border-2 border-white shadow-sm object-cover" />
              <Image src="/images/avatars/avatar-4.jpeg" alt="User" width={36} height={36} className="w-9 h-9 rounded-full border-2 border-white shadow-sm object-cover" />
            </div>

            {/* Divider */}
            <div className="w-px h-6 bg-gray-300" />

            {/* Rating */}
            <div className="flex items-center gap-1.5">
              <div className="flex text-yellow-400 text-sm">
                <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
              </div>
              <span className="font-bold text-text-dark">4.9</span>
            </div>
          </div>

          {/* Trust Badges */}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
              <ClockIcon className="w-4 h-4 text-brand-primary" />
              <span className="font-medium">{tTrust('instantResults')}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
              <BanknotesIcon className="w-4 h-4 text-brand-primary" />
              <span className="font-medium">{tTrust('noSubscription')}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
              <ShieldCheckIcon className="w-4 h-4 text-brand-primary" />
              <span className="font-medium">{tTrust('moneyBack')}</span>
            </div>
          </div>
        </div>

        {/* Before/After Slider - Using standard component for consistency */}
        <div className="relative rounded-2xl overflow-hidden shadow-depth-xl border border-bg-gray-100">
          <BeforeAfterSlider
            beforeSrc={solution.beforeImage}
            afterSrc={solution.heroImage}
            alt={`${industry} AI headshot transformation`}
            aspectRatio="3/4"
            size="lg"
            showHint={true}
            showStatsBadge={true}
            priority={true}
            sizes="(min-width: 1024px) 40vw, 90vw"
          />
        </div>
        </div>
        </div>
      </div>
    </section>
  )
}
