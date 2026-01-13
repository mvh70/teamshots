import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { getLandingVariant } from '@/config/landing-content'
import { getSolutionBySlug, SOLUTIONS, type SolutionIndustry } from '@/config/solutions'
import { getBaseUrl } from '@/lib/url'

type Props = {
  params: Promise<{ locale: string; industry: string }>
}

type SolutionTranslations = {
  heroTitle: string
  heroSubtitle: string
  bullets: string[]
  seoTitle: string
  seoDescription: string
  stylingNotes: string[]
}

async function getSolutionTranslations(locale: string, industry: string): Promise<SolutionTranslations> {
  // Loads from messages/* via src/i18n/request.ts (TeamShotsPro merges solutions.*)
  const t = await getTranslations({ locale, namespace: `solutions.${industry}` })
  return {
    heroTitle: t('heroTitle'),
    heroSubtitle: t('heroSubtitle'),
    bullets: t.raw('bullets') as string[],
    seoTitle: t('seoTitle'),
    seoDescription: t('seoDescription'),
    stylingNotes: t.raw('stylingNotes') as string[],
  }
}

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    SOLUTIONS.map((s) => ({
      locale,
      industry: s.slug,
    })),
  )
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, industry } = await params
  const headersList = await headers()

  const solution = getSolutionBySlug(industry)
  if (!solution) notFound()

  const baseUrl = getBaseUrl(headersList)
  const copy = await getSolutionTranslations(locale, solution.slug)
  const canonical = `${baseUrl}${locale === 'es' ? '/es' : ''}/solutions/${solution.slug}`

  return {
    title: copy.seoTitle,
    description: copy.seoDescription,
    alternates: {
      canonical,
      languages: {
        en: `${baseUrl}/solutions/${solution.slug}`,
        es: `${baseUrl}/es/solutions/${solution.slug}`,
      },
    },
    openGraph: {
      title: copy.seoTitle,
      description: copy.seoDescription,
      url: canonical,
    },
  }
}

export default async function SolutionIndustryPage({ params }: Props) {
  const { locale, industry } = await params
  const headersList = await headers()

  // TeamShotsPro-only pages (B2B verticals)
  const host = headersList.get('host') || headersList.get('x-forwarded-host')
  const domain = host ? host.split(':')[0].replace(/^www\./, '').toLowerCase() : undefined
  const variant = getLandingVariant(domain)
  if (variant !== 'teamshotspro') {
    notFound()
  }

  const solution = getSolutionBySlug(industry)
  if (!solution) notFound()

  const copy = await getSolutionTranslations(locale, solution.slug)

  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-bg-gray-50 bg-bg-white shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/6 via-transparent to-brand-primary-hover/6 pointer-events-none" />
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] p-8 sm:p-10 lg:p-12 relative">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-brand-primary mb-4">
              <span className="h-2 w-2 rounded-full bg-brand-primary" aria-hidden="true" />
              {solution.label}
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-extrabold tracking-tight text-text-dark leading-[1.05]">
              {copy.heroTitle}
            </h1>
            <p className="mt-5 text-lg sm:text-xl text-text-body leading-relaxed max-w-2xl">
              {copy.heroSubtitle}
            </p>

            <ul className="mt-8 space-y-3 text-text-body">
              {copy.bullets.map((b) => (
                <li key={b} className="flex items-start gap-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-brand-secondary" aria-hidden="true" />
                  <span className="text-base sm:text-lg">{b}</span>
                </li>
              ))}
            </ul>

            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <Link
                href="/auth/signup"
                className="inline-flex justify-center items-center rounded-xl bg-brand-cta px-6 py-4 text-white font-semibold hover:bg-brand-cta-hover transition-colors"
              >
                {locale === 'es' ? 'Empezar' : 'Get started'}
              </Link>
              <Link
                href="/pricing"
                className="inline-flex justify-center items-center rounded-xl border border-bg-gray-50 bg-bg-white px-6 py-4 text-text-dark font-semibold hover:border-brand-primary/40 hover:shadow-sm transition-all"
              >
                {locale === 'es' ? 'Ver precios' : 'See pricing'}
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="aspect-[4/5] w-full overflow-hidden rounded-2xl border border-bg-gray-50 bg-bg-gray-50 shadow-lg">
              <Image
                src={solution.heroImage}
                alt={copy.heroTitle}
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 40vw, 90vw"
                priority
              />
            </div>
            <p className="mt-3 text-xs text-text-muted">
              {locale === 'es'
                ? 'Imagen de ejemplo. Reemplaza el asset cuando tengas muestras por industria.'
                : 'Placeholder example image. Replace with industry-specific samples when ready.'}
            </p>
          </div>
        </div>
      </section>

      {/* Styling notes */}
      <section className="mt-14 sm:mt-16">
        <h2 className="text-2xl sm:text-3xl font-display font-bold text-text-dark">
          {locale === 'es' ? 'Guía de estilo' : 'Styling guide'}
        </h2>
        <p className="mt-3 text-text-body max-w-3xl leading-relaxed">
          {locale === 'es'
            ? 'Estas recomendaciones ayudan a generar resultados coherentes para este vertical.'
            : 'These guidelines help generate consistent results for this vertical.'}
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {copy.stylingNotes.map((note) => (
            <div
              key={note}
              className="rounded-2xl border border-bg-gray-50 bg-bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <p className="text-text-body font-medium leading-relaxed">{note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Internal navigation (TeamShotsPro-only, non-link-farm) */}
      <section className="mt-14 sm:mt-16">
        <div className="rounded-2xl border border-bg-gray-50 bg-bg-white p-6 sm:p-8 shadow-sm">
          <h2 className="text-xl sm:text-2xl font-display font-bold text-text-dark">
            {locale === 'es' ? 'Más soluciones' : 'More solutions'}
          </h2>
          <p className="mt-2 text-text-body">
            {locale === 'es'
              ? 'Páginas específicas por industria para equipos.'
              : 'Industry-specific pages for teams.'}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {SOLUTIONS.map((s) => (
              <Link
                key={s.slug}
                href={`/${locale === 'es' ? 'es/' : ''}solutions/${s.slug}`}
                className={`rounded-full px-4 py-2 text-sm font-semibold border transition-colors ${
                  s.slug === (industry as SolutionIndustry)
                    ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                    : 'border-bg-gray-50 bg-bg-white text-text-body hover:border-brand-primary/40 hover:text-text-dark'
                }`}
              >
                {s.label}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

