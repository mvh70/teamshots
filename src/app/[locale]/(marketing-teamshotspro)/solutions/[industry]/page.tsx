import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getLandingVariant } from '@/config/landing-content'
import { getSolutionBySlug, SOLUTIONS } from '@/config/solutions'
import { getSpanishSolutionSlug } from '@/config/spanish-slugs'
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
import { SolutionSchema } from './schema'

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
        es: spanishSlug ? `${baseUrl}/es/soluciones/${spanishSlug}` : `${baseUrl}/es/solutions/${solution.slug}`,
        'x-default': `${baseUrl}/solutions/${solution.slug}`,
      },
    },
    openGraph: {
      type: 'website',
      locale: locale === 'es' ? 'es_ES' : 'en_US',
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
      `${solution.label.toLowerCase()} headshots`,
      `AI headshots for ${solution.label.toLowerCase()}`,
      'professional team photos',
      'corporate headshots',
      'AI photography',
      'team photos',
      ...solution.platforms.map(p => `headshots for ${p.toLowerCase()}`),
    ],
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
  const host = headersList.get('x-forwarded-host') || headersList.get('host')
  const domain = host ? host.split(':')[0].replace(/^www\./, '').toLowerCase() : undefined
  const variant = getLandingVariant(domain)
  if (variant !== 'teamshotspro') {
    notFound()
  }

  const solution = getSolutionBySlug(industry)
  if (!solution) notFound()

  // Get translations for schema data
  const baseUrl = getBaseUrl(headersList)
  const brandName = getBrand(headersList).name
  const t = await getTranslations({ locale, namespace: `solutions.${solution.slug}` })

  // Extract data for schema
  const seo = {
    title: t('seo.title'),
    description: t('seo.description'),
  }
  const faqItems = t.raw('faq.items') as Array<{ question: string; answer: string }>
  const testimonials = t.raw('testimonials.items') as Array<{
    quote: string;
    author: string;
    role: string;
    company: string;
  }>
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
        brandName={brandName}
        locale={locale}
        solution={solution}
        seo={seo}
        faqItems={faqItems}
        testimonials={testimonials}
        howItWorksSteps={howItWorksSteps}
        comparisonRows={comparisonRows}
      />

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
    </>
  )
}
