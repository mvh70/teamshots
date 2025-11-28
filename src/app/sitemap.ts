import { MetadataRoute } from 'next'
import { routing } from '@/i18n/routing'
import { TEAM_DOMAIN, INDIVIDUAL_DOMAIN } from '@/config/domain'

/**
 * Generate sitemap.xml for SEO
 * 
 * Next.js automatically serves this at /sitemap.xml
 * Includes all public pages for both domains and locales (en, es)
 * 
 * Both domains (teamshotspro.com and photoshotspro.com) serve the same
 * public pages, so we include entries for both.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  // Both domains serve the same public pages
  const domains = [
    `https://${TEAM_DOMAIN}`,
    `https://${INDIVIDUAL_DOMAIN}`,
  ]
  
  // Public routes that should be indexed
  const publicRoutes = [
    '',           // Landing page
    '/pricing',   // Pricing page
  ]
  
  // Generate sitemap entries for each domain, route, and locale
  const entries: MetadataRoute.Sitemap = []
  
  for (const domain of domains) {
    for (const route of publicRoutes) {
      // English (default locale - no prefix due to 'as-needed' config)
      entries.push({
        url: `${domain}${route}`,
        lastModified: new Date(),
        changeFrequency: route === '' ? 'daily' : 'weekly',
        priority: route === '' ? 1.0 : 0.8,
      })
      
      // Spanish (with /es prefix)
      entries.push({
        url: `${domain}/es${route}`,
        lastModified: new Date(),
        changeFrequency: route === '' ? 'daily' : 'weekly',
        priority: route === '' ? 1.0 : 0.8,
      })
    }
  }
  
  return entries
}

