import { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { getBaseUrl } from '@/lib/url'
import { getLandingVariant } from '@/config/landing-content'
import { SOLUTIONS } from '@/config/solutions'
import { routing } from '@/i18n/routing'

/**
 * Domain-aware sitemap
 * Returns different content based on the incoming domain:
 * - TeamShotsPro: blog + solutions + shared routes
 * - IndividualShots: blog + shared routes
 * - Others: shared routes only
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let baseUrl: string
  let variant: ReturnType<typeof getLandingVariant>
  
  try {
    const headersList = await headers()
    baseUrl = getBaseUrl(headersList)
    const host = headersList.get('host') || headersList.get('x-forwarded-host')
    const domain = host ? host.split(':')[0].replace(/^www\./, '').toLowerCase() : undefined
    variant = getLandingVariant(domain)
  } catch {
    baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://teamshotspro.com'
    variant = 'teamshotspro'
  }
  
  // Shared routes for all domains
  const sharedRoutes = [
    '', // Landing page
    '/pricing',
    '/legal/privacy',
    '/legal/terms',
  ]
  
  // Domain-specific routes
  let domainRoutes: string[] = []
  
  if (variant === 'teamshotspro') {
    // TeamShotsPro: blog + solutions
    const blogSlugs = ['corporate-ai-headshots', 'remote-onboarding-broken']
    domainRoutes = [
      '/blog',
      ...blogSlugs.map(slug => `/blog/${slug}`),
      ...SOLUTIONS.map(s => `/solutions/${s.slug}`)
    ]
  } else if (variant === 'individualshots') {
    // IndividualShots: blog only
    const blogSlugs = [
      'free-vs-paid-ai-headshots',
      'professional-headshot-photography-cost',
      'ai-headshot-maker-individual',
      'ai-headshot-etiquette',
      'update-headshot-frequency',
      'headshot-background-colors',
      'headshot-clothing-tips',
    ]
    domainRoutes = [
      '/blog',
      ...blogSlugs.map(slug => `/blog/${slug}`)
    ]
  }
  // Other domains (coupleshots, familyshots, rightclickfit): no blog/solutions yet
  
  const allRoutes = [...sharedRoutes, ...domainRoutes]
  const entries: MetadataRoute.Sitemap = []
  
  for (const route of allRoutes) {
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
  
  return entries
}
