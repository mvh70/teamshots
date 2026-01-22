import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSolutionBySlug, SOLUTIONS } from '@/config/solutions'
import { getEnglishSolutionSlug, SPANISH_SOLUTION_SLUGS } from '@/config/spanish-slugs'
import { getLandingVariant } from '@/config/landing-content'
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

type Props = {
  params: Promise<{ locale: string; slug: string }>
}

export function generateStaticParams() {
  // Generate params only for Spanish locale with Spanish slugs
  return Object.keys(SPANISH_SOLUTION_SLUGS).map((spanishSlug) => ({
    locale: 'es',
    slug: spanishSlug,
  }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  const headersList = await headers()

  // This route is only for Spanish - redirect English to /solutions
  if (locale !== 'es') {
    return {}
  }

  // Map Spanish slug to English slug
  const englishSlug = getEnglishSolutionSlug(slug)
  if (!englishSlug) notFound()

  const solution = getSolutionBySlug(englishSlug)
  if (!solution) notFound()

  const baseUrl = getBaseUrl(headersList)
  const t = await getTranslations({ locale, namespace: `solutions.${solution.slug}` })

  const seoTitle = t('seo.title')
  const seoDescription = t('seo.description')
  const canonical = `${baseUrl}/es/soluciones/${slug}`

  return {
    title: seoTitle,
    description: seoDescription,
    alternates: {
      canonical,
      languages: {
        en: `${baseUrl}/solutions/${solution.slug}`,
        es: `${baseUrl}/es/soluciones/${slug}`,
      },
    },
    openGraph: {
      title: seoTitle,
      description: seoDescription,
      url: canonical,
    },
  }
}

export default async function SolucionesPage({ params }: Props) {
  const { locale, slug } = await params
  const headersList = await headers()

  // This route is only for Spanish - redirect English to /solutions
  if (locale !== 'es') {
    const englishSlug = getEnglishSolutionSlug(slug)
    if (englishSlug) {
      redirect(`/solutions/${englishSlug}`)
    }
    notFound()
  }

  // Map Spanish slug to English slug
  const englishSlug = getEnglishSolutionSlug(slug)
  if (!englishSlug) notFound()

  // TeamShotsPro-only pages (B2B verticals)
  const host = headersList.get('host') || headersList.get('x-forwarded-host')
  const domain = host ? host.split(':')[0].replace(/^www\./, '').toLowerCase() : undefined
  const variant = getLandingVariant(domain)
  if (variant !== 'teamshotspro') {
    notFound()
  }

  const solution = getSolutionBySlug(englishSlug)
  if (!solution) notFound()

  return (
    <div className="relative space-y-0">
      {/* Hero Section */}
      <IndustryHero industry={englishSlug} solution={solution} locale={locale} />

      {/* Trust Logos (only shows if logos are configured) */}
      <TrustLogos solution={solution} locale={locale} />

      {/* Pain Points */}
      <IndustryPainPoints industry={englishSlug} />

      {/* Showcase Gallery */}
      <IndustryShowcase industry={englishSlug} solution={solution} />

      {/* How It Works */}
      <IndustryHowItWorks industry={englishSlug} />

      {/* Cost Comparison vs Traditional */}
      <IndustryComparison industry={englishSlug} />

      {/* Use Cases */}
      <IndustryUseCases industry={englishSlug} />

      {/* Testimonials */}
      <IndustryTestimonials industry={englishSlug} />

      {/* Pricing */}
      <IndustryPricing industry={englishSlug} locale={locale} />

      {/* Guarantee */}
      <IndustryGuarantee locale={locale} />

      {/* FAQ */}
      <IndustryFAQ industry={englishSlug} />

      {/* Final CTA */}
      <IndustryFinalCTA industry={englishSlug} locale={locale} />
    </div>
  )
}
