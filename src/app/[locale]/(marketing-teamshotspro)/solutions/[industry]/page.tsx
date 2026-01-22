import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { getLandingVariant } from '@/config/landing-content'
import { getSolutionBySlug, SOLUTIONS } from '@/config/solutions'
import { getSpanishSolutionSlug } from '@/config/spanish-slugs'
import { getBaseUrl } from '@/lib/url'
import {
  IndustryHero,
  IndustryPainPoints,
  IndustryShowcase,
  IndustryHowItWorks,
  IndustryComparison,
  IndustryUseCases,
  IndustryTestimonials,
  IndustryPricing,
  IndustryFAQ,
  IndustryFinalCTA,
  IndustryGuarantee,
  TrustLogos,
} from '@/components/solutions'

// Force dynamic rendering since we use headers() for brand detection
export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ locale: string; industry: string }>
}

export function generateStaticParams() {
  // Generate for English only - Spanish uses /soluciones route
  return SOLUTIONS.map((s) => ({
    locale: 'en',
    industry: s.slug,
  }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, industry } = await params
  const headersList = await headers()

  const solution = getSolutionBySlug(industry)
  if (!solution) notFound()

  const baseUrl = getBaseUrl(headersList)
  const t = await getTranslations({ locale, namespace: `solutions.${solution.slug}` })

  const seoTitle = t('seo.title')
  const seoDescription = t('seo.description')
  const canonical = `${baseUrl}/solutions/${solution.slug}`
  const spanishSlug = getSpanishSolutionSlug(industry)

  return {
    title: seoTitle,
    description: seoDescription,
    alternates: {
      canonical,
      languages: {
        en: `${baseUrl}/solutions/${solution.slug}`,
        es: spanishSlug ? `${baseUrl}/es/soluciones/${spanishSlug}` : `${baseUrl}/es/solutions/${solution.slug}`,
      },
    },
    openGraph: {
      title: seoTitle,
      description: seoDescription,
      url: canonical,
    },
  }
}

export default async function SolutionIndustryPage({ params }: Props) {
  const { locale, industry } = await params
  const headersList = await headers()

  // Redirect Spanish users to /soluciones with Spanish slug
  if (locale === 'es') {
    const spanishSlug = getSpanishSolutionSlug(industry)
    if (spanishSlug) {
      redirect(`/es/soluciones/${spanishSlug}`)
    }
    // If no Spanish slug mapping exists, still show the page
  }

  // TeamShotsPro-only pages (B2B verticals)
  const host = headersList.get('host') || headersList.get('x-forwarded-host')
  const domain = host ? host.split(':')[0].replace(/^www\./, '').toLowerCase() : undefined
  const variant = getLandingVariant(domain)
  if (variant !== 'teamshotspro') {
    notFound()
  }

  const solution = getSolutionBySlug(industry)
  if (!solution) notFound()

  return (
    <div className="relative space-y-0">
      {/* Hero Section */}
      <IndustryHero industry={industry} solution={solution} locale={locale} />

      {/* Trust Logos (only shows if logos are configured) */}
      <TrustLogos solution={solution} locale={locale} />

      {/* Pain Points */}
      <IndustryPainPoints industry={industry} />

      {/* Showcase Gallery */}
      <IndustryShowcase industry={industry} solution={solution} />

      {/* How It Works */}
      <IndustryHowItWorks industry={industry} />

      {/* Comparison Table */}
      <IndustryComparison industry={industry} />

      {/* Use Cases / Platforms */}
      <IndustryUseCases industry={industry} />

      {/* Testimonials */}
      <IndustryTestimonials industry={industry} />

      {/* Pricing */}
      <IndustryPricing industry={industry} locale={locale} />

      {/* Human-Look Guarantee */}
      <IndustryGuarantee locale={locale} />

      {/* FAQ */}
      <IndustryFAQ industry={industry} />

      {/* Final CTA */}
      <IndustryFinalCTA industry={industry} locale={locale} />
    </div>
  )
}
