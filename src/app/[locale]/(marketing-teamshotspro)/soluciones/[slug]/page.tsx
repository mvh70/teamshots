import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSolutionBySlug } from '@/config/solutions'
import { getEnglishSolutionSlug, SPANISH_SOLUTION_SLUGS } from '@/config/spanish-slugs'
import { getLandingVariant } from '@/config/landing-content'
import { getBaseUrl } from '@/lib/url'
import { getBrand } from '@/config/brand'
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
import { SolutionSchema } from '../../solutions/[industry]/schema'

// Force dynamic rendering since we use headers() for brand detection
export const dynamic = 'force-dynamic'

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

  // Use hero image for OG or fallback to default
  const ogImage = solution.heroImage.startsWith('/')
    ? `${baseUrl}${solution.heroImage}`
    : solution.heroImage

  return {
    title: seoTitle,
    description: seoDescription,
    alternates: {
      canonical,
      languages: {
        en: `${baseUrl}/solutions/${solution.slug}`,
        es: `${baseUrl}/es/soluciones/${slug}`,
        'x-default': `${baseUrl}/solutions/${solution.slug}`,
      },
    },
    openGraph: {
      type: 'website',
      locale: 'es_ES',
      title: seoTitle,
      description: seoDescription,
      url: canonical,
      siteName: 'TeamShotsPro',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${solution.label} AI Headshots - TeamShotsPro`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: seoTitle,
      description: seoDescription,
      images: [ogImage],
      creator: '@teamshotspro',
    },
    keywords: [
      `fotos profesionales ${solution.label.toLowerCase()}`,
      `headshots IA para ${solution.label.toLowerCase()}`,
      'fotos corporativas equipo',
      'headshots profesionales',
      'fotografía IA',
      'fotos de equipo',
    ],
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
  const host = headersList.get('x-forwarded-host') || headersList.get('host')
  const domain = host ? host.split(':')[0].replace(/^www\./, '').toLowerCase() : undefined
  const variant = getLandingVariant(domain)
  if (variant !== 'teamshotspro') {
    notFound()
  }

  const solution = getSolutionBySlug(englishSlug)
  if (!solution) notFound()

  // Get translations for schema data
  const baseUrl = getBaseUrl(headersList)
  const brand = getBrand(headersList)
  const t = await getTranslations({ locale, namespace: `solutions.${solution.slug}` })

  // Extract data for schema
  const seo = {
    title: t('seo.title'),
    description: t('seo.description'),
  }
  const faqItems = t.raw('faq.items') as Array<{ question: string; answer: string }>
  const howItWorksSteps = t.raw('howItWorks.steps') as Array<{
    number: string;
    title: string;
    description: string;
  }>
  const comparisonRows = t.raw('comparison.rows') as string[][]

  return (
    <>
      {/* SEO Schema Markup */}
      <SolutionSchema
        baseUrl={baseUrl}
        brand={brand}
        locale={locale}
        solution={solution}
        seo={seo}
        faqItems={faqItems}
        howItWorksSteps={howItWorksSteps}
        comparisonRows={comparisonRows}
      />

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
    </>
  )
}
