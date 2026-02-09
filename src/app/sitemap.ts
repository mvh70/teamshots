import { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { getBaseUrl } from '@/lib/url'
import { getLandingVariant } from '@/config/landing-content'
import { SOLUTIONS } from '@/config/solutions'
import { routing } from '@/i18n/routing'
import { getAllPublishedSlugs, variantToBrandId } from '@/lib/cms'

const TEAMSHOTS_HOST = 'teamshotspro.com'
const TEAMSHOTS_CANONICAL_HOST = 'www.teamshotspro.com'

function normalizeSitemapBaseUrl(url: string): string {
  const cleanUrl = url.replace(/\/$/, '')

  try {
    const parsed = new URL(cleanUrl)
    if (parsed.hostname === TEAMSHOTS_HOST || parsed.hostname === TEAMSHOTS_CANONICAL_HOST) {
      parsed.protocol = 'https:'
      parsed.hostname = TEAMSHOTS_CANONICAL_HOST
    }
    return parsed.toString().replace(/\/$/, '')
  } catch {
    // Keep a safe string fallback if URL parsing fails for any reason.
    return cleanUrl.replace(/^https?:\/\/teamshotspro\.com$/i, `https://${TEAMSHOTS_CANONICAL_HOST}`)
  }
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
    baseUrl = normalizeSitemapBaseUrl(getBaseUrl(headersList))
    const host = headersList.get('x-forwarded-host') || headersList.get('host')
    const domain = host ? host.split(':')[0].replace(/^www\./, '').toLowerCase() : undefined
    variant = getLandingVariant(domain)
  } catch {
    baseUrl = normalizeSitemapBaseUrl(process.env.NEXT_PUBLIC_BASE_URL || `https://${TEAMSHOTS_CANONICAL_HOST}`)
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
          lastModified: new Date(),
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
        lastModified: new Date(),
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
    for (const { en, es } of blogSlugs) {
      // English version
      entries.push({
        url: `${baseUrl}/blog/${en}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      })

      // Spanish version (use localized slug if available)
      const spanishSlug = es || en
      entries.push({
        url: `${baseUrl}/es/blog/${spanishSlug}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      })
    }
  }

  // Add solution routes (TeamShotsPro only)
  if (variant === 'teamshotspro') {
    // From CMS database
    for (const { en, es } of solutionSlugs) {
      entries.push({
        url: `${baseUrl}/solutions/${en}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      })

      // Spanish version with localized path and slug
      const spanishSlug = es || en
      entries.push({
        url: `${baseUrl}/es/soluciones/${spanishSlug}`,
        lastModified: new Date(),
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
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.8,
          })
        }
      }
    }
  }

  return entries
}
