import { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { getBaseUrl } from '@/lib/url'

const TEAMSHOTS_HOST = 'teamshotspro.com'
const TEAMSHOTS_CANONICAL_HOST = 'www.teamshotspro.com'

function normalizeRobotsBaseUrl(url: string): string {
  const cleanUrl = url.replace(/\/$/, '')

  try {
    const parsed = new URL(cleanUrl)
    if (parsed.hostname === TEAMSHOTS_HOST || parsed.hostname === TEAMSHOTS_CANONICAL_HOST) {
      parsed.protocol = 'https:'
      parsed.hostname = TEAMSHOTS_CANONICAL_HOST
    }
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return cleanUrl.replace(/^https?:\/\/teamshotspro\.com$/i, `https://${TEAMSHOTS_CANONICAL_HOST}`)
  }
}

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
  const baseUrl = normalizeRobotsBaseUrl(getBaseUrl(headersList))
  
  // Remove trailing slash
  const cleanBaseUrl = baseUrl.replace(/\/$/, '')
  
  return {
    rules: {
      userAgent: '*',
      allow: [
        '/',                      // English (default locale, no prefix)
        '/es/',                   // Spanish locale
        '/pricing',               // Pricing page
        '/blog',                  // Blog index
        '/blog/',                 // Blog posts
        '/solutions/',            // Solutions pages
        '/headshot-cost-calculator', // Calculator tool
        '/legal/',                // Legal pages
      ],
      disallow: [
        '/app/',                  // App routes (authenticated)
        '/api/',                  // API routes
        '/auth/',                 // Auth pages (no need to index)
        '/invite/',               // Invite pages (private)
        '/invite-dashboard/',     // Private invite dashboards
        '/dashboard/',            // Dashboard (authenticated)
        '/cdn-cgi/',              // Cloudflare email protection
        '/upload/',               // Upload pages (private)
        '/upload-selfie/',        // Mobile upload pages (private)
      ],
    },
    sitemap: `${cleanBaseUrl}/sitemap.xml`,
  }
}
