import { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { getBaseUrl } from '@/lib/url'

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
  // Use headers() directly here instead of getServerBaseUrl() to avoid build-time issues
  let baseUrl: string
  try {
    const headersList = await headers()
    baseUrl = getBaseUrl(headersList)
  } catch {
    // Fallback during build time when headers() is not available
    // This happens during static generation
    baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://teamshotspro.com'
  }
  
  // Public routes that should be indexed
  const publicRoutes = [
    '',           // Landing page
    '/pricing',   // Pricing page
    '/blog',      // Blog index
    '/blog/ai-headshots-for-linkedin', // Blog: AI Headshots for LinkedIn
    '/blog/free-vs-paid-ai-headshots', // Blog: Free vs Paid comparison
    '/blog/corporate-ai-headshots',    // Blog: Corporate AI Headshots
    '/blog/best-ai-headshot-generators', // Blog: Best generators comparison
    '/blog/free-ai-headshot-generator', // Blog: Free AI Headshot Generator
    '/blog/professional-headshots-ai', // Blog: Professional Headshots AI
    '/blog/headshot-ai-generator',     // Blog: Headshot AI Generator
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
