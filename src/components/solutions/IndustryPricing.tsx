'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import SeatsPricingCard from '@/components/pricing/SeatsPricingCard'
import PricingCard from '@/components/pricing/PricingCard'
import { PRICING_CONFIG } from '@/config/pricing'
import { formatPrice, getPricePerPhoto } from '@/domain/pricing/utils'

interface PricingProps {
  industry: string
  locale: string
}

export function IndustryPricing({ industry, locale }: PricingProps) {
  const t = useTranslations(`solutions.${industry}.pricing`)

  return (
    <section className="py-16 sm:py-20 lg:py-24 bg-bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-text-dark mb-4">
            {t('title')}
          </h2>
          <p className="text-lg sm:text-xl text-text-body max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Standard Seats Pricing Card */}
          <SeatsPricingCard
            unauth
            initialSeats={10}
            className="shadow-depth-xl"
          />

          {/* Standard Free Trial Card */}
          <PricingCard
            id="free"
            price="Free"
            credits={PRICING_CONFIG.freeTrial.pro}
            regenerations={PRICING_CONFIG.regenerations.free}
            pricePerPhoto={formatPrice(getPricePerPhoto('free'))}
            ctaMode="link"
            href="/auth/signup"
            className="h-full"
          />
        </div>

        {/* Compare pricing link */}
        <div className="text-center mt-10">
          <Link
            href="/pricing"
            className="text-brand-primary font-semibold hover:underline inline-flex items-center gap-2"
          >
            {locale === 'es' ? 'Ver todos los planes y comparar' : 'See all plans and compare'}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
