import { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { getBaseUrl, normalizeBaseUrlForSeo } from '@/lib/url'
import { getLandingVariant } from '@/config/landing-content'
import { SOLUTIONS } from '@/config/solutions'
import { routing } from '@/i18n/routing'
import { getAllPublishedSlugs, variantToBrandId } from '@/lib/cms'

// Use the start of the current month as a reasonable "last modified" for static pages.
// This avoids hardcoding a date that goes stale and signals freshness to search engines.
const STATIC_LAST_MODIFIED = (() => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
})()

function parsePublishedDate(publishedAt: string | number | null | undefined): Date | null {
  if (!publishedAt) return null

  if (typeof publishedAt === 'number') {
    const parsed = new Date(publishedAt > 1_000_000_000_000 ? publishedAt : publishedAt * 1000)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const value = String(publishedAt).trim()
  if (!value) return null

  if (/^\d{13}$/.test(value)) {
    const parsed = new Date(Number(value))
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  if (/^\d{10}$/.test(value)) {
    const parsed = new Date(Number(value) * 1000)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getPublishedLastModified(publishedAt: string | number | null | undefined): Date {
  return parsePublishedDate(publishedAt) ?? STATIC_LAST_MODIFIED
}

/**
 * Domain-aware sitemap
 * Dynamically reads published content from CMS database.
 * - TeamShotsPro: blog + solutions + shared routes
 * - IndividualShots: blog + shared routes
 * - Others: shared routes only
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let baseUrl: string
  let variant: ReturnType<typeof getLandingVariant>

  try {
    const headersList = await headers()
    baseUrl = normalizeBaseUrlForSeo(getBaseUrl(headersList))
    const host = headersList.get('x-forwarded-host') || headersList.get('host')
    const domain = host ? host.split(':')[0].replace(/^www\./, '').toLowerCase() : undefined
    variant = getLandingVariant(domain)
  } catch {
    baseUrl = normalizeBaseUrlForSeo(process.env.NEXT_PUBLIC_BASE_URL || 'https://teamshotspro.com')
    variant = 'teamshotspro'
  }

  const entries: MetadataRoute.Sitemap = []

  // Shared routes for all domains
  const sharedRoutes = [
    '', // Landing page
    '/pricing',
    '/legal/privacy',
    '/legal/terms',
  ]

  // TeamShotsPro-specific marketing routes
  const teamshotsproRoutes = [
    '/headshot-cost-calculator',
  ]

  // Add TeamShotsPro-specific routes
  if (variant === 'teamshotspro') {
    for (const route of teamshotsproRoutes) {
      for (const locale of routing.locales) {
        const path = locale === 'en' ? route : `/${locale}${route}`
        entries.push({
          url: `${baseUrl}${path}`,
          lastModified: STATIC_LAST_MODIFIED,
          changeFrequency: 'weekly',
          priority: 0.9,
        })
      }
    }
  }

  // Add shared routes for all locales
  for (const route of sharedRoutes) {
    for (const locale of routing.locales) {
      const path = locale === 'en' ? route : `/${locale}${route}`
      entries.push({
        url: `${baseUrl}${path}`,
        lastModified: STATIC_LAST_MODIFIED,
        changeFrequency: route === '' ? 'daily' : 'weekly',
        priority: route === '' ? 1.0 : 0.8,
      })
    }
  }

  // Get published content from CMS database
  const brandId = variantToBrandId(variant)
  const { blogSlugs, solutionSlugs } = getAllPublishedSlugs(brandId)

  // Add blog routes
  if (blogSlugs.length > 0 || variant === 'teamshotspro' || variant === 'individualshots') {
    // Blog index page
    for (const locale of routing.locales) {
      const path = locale === 'en' ? '/blog' : `/${locale}/blog`
      entries.push({
        url: `${baseUrl}${path}`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.9,
      })
    }

    // Individual blog posts
    for (const { en, es, publishedAt } of blogSlugs) {
      // English version
      entries.push({
        url: `${baseUrl}/blog/${en}`,
        lastModified: getPublishedLastModified(publishedAt),
        changeFrequency: 'weekly',
        priority: 0.8,
      })

      // Spanish version (only include when a published/approved translation exists)
      if (es) {
        entries.push({
          url: `${baseUrl}/es/blog/${es}`,
          lastModified: getPublishedLastModified(publishedAt),
          changeFrequency: 'weekly',
          priority: 0.8,
        })
      }
    }
  }

  // Add solution routes (TeamShotsPro only)
  if (variant === 'teamshotspro') {
    // From CMS database
    for (const { en, es, publishedAt } of solutionSlugs) {
      entries.push({
        url: `${baseUrl}/solutions/${en}`,
        lastModified: getPublishedLastModified(publishedAt),
        changeFrequency: 'weekly',
        priority: 0.8,
      })

      // Spanish version with localized path and slug
      const spanishSlug = es || en
      entries.push({
        url: `${baseUrl}/es/soluciones/${spanishSlug}`,
        lastModified: getPublishedLastModified(publishedAt),
        changeFrequency: 'weekly',
        priority: 0.8,
      })
    }

    // Also include static SOLUTIONS config as fallback
    for (const solution of SOLUTIONS) {
      // Check if already added from CMS
      const alreadyAdded = solutionSlugs.some((s) => s.en === solution.slug)
      if (!alreadyAdded) {
        for (const locale of routing.locales) {
          const path = locale === 'en' ? `/solutions/${solution.slug}` : `/${locale}/solutions/${solution.slug}`
          entries.push({
            url: `${baseUrl}${path}`,
            lastModified: STATIC_LAST_MODIFIED,
            changeFrequency: 'weekly',
            priority: 0.8,
          })
        }
      }
    }
  }

  return entries
}
