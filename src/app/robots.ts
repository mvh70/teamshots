import { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { getBaseUrl } from '@/lib/url'

/**
 * Generate robots.txt for SEO
 * 
 * Next.js automatically serves this at /robots.txt
 * Allows all crawlers and points to sitemap
 * 
 * Domain-aware: Each domain points to its own sitemap
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const headersList = await headers()
  const baseUrl = getBaseUrl(headersList)
  
  // Remove trailing slash
  const cleanBaseUrl = baseUrl.replace(/\/$/, '')
  
  return {
    rules: {
      userAgent: '*',
      allow: [
        '/',          // English (default locale, no prefix)
        '/es/',       // Spanish locale
      ],
      disallow: [
        '/app/',      // App routes (authenticated)
        '/api/',      // API routes
        '/auth/',     // Auth pages (no need to index)
        '/invite/',   // Invite pages (private)
        '/invite-dashboard/', // Private invite dashboards
        '/dashboard/', // Dashboard (authenticated)
        '/cdn-cgi/',   // Cloudflare email protection
      ],
    },
    sitemap: `${cleanBaseUrl}/sitemap.xml`,
  }
}

