import { MetadataRoute } from 'next'
import { getServerBaseUrl } from '@/lib/url'

/**
 * Generate sitemap.xml for SEO
 * 
 * Next.js automatically serves this at /sitemap.xml
 * Includes all public pages for the CURRENT domain and locales (en, es)
 * 
 * Domain-aware: Generates URLs only for the domain requesting the sitemap
 * to avoid Google "Deceptive Pages" warnings (link farming/impersonation).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = await getServerBaseUrl()
  
  // Public routes that should be indexed
  const publicRoutes = [
    '',           // Landing page
    '/pricing',   // Pricing page
    '/blog',      // Blog index
    '/blog/best-ai-headshot-generators', // Blog post
    '/legal/privacy', // Privacy Policy
    '/legal/terms',   // Terms of Service
  ]
  
  // Generate sitemap entries for the current domain, route, and locale
  const entries: MetadataRoute.Sitemap = []
  
  for (const route of publicRoutes) {
    // English (default locale - no prefix due to 'as-needed' config)
    entries.push({
      url: `${baseUrl}${route}`,
      lastModified: new Date(),
      changeFrequency: route === '' ? 'daily' : 'weekly',
      priority: route === '' ? 1.0 : 0.8,
    })
    
    // Spanish (with /es prefix)
    entries.push({
      url: `${baseUrl}/es${route}`,
      lastModified: new Date(),
      changeFrequency: route === '' ? 'daily' : 'weekly',
      priority: route === '' ? 1.0 : 0.8,
    })
  }
  
  return entries
}
