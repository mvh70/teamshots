import { Metadata } from 'next'
import { routing } from '@/i18n/routing'

type ConstructMetadataParams = {
    baseUrl: string    // The base URL of the current domain (e.g. "https://teamshotspro.com")
    path?: string      // e.g. "/pricing" or "/blog/my-post"
    title: string
    description?: string
    image?: string     // Override for og:image, defaults to /branding/og-image.jpg
    locale?: string    // Current locale
    noIndex?: boolean
    siteName?: string  // Override for og:site_name
}

/**
 * Helper to construct consistent SEO metadata with proper canonicals and hreflangs.
 * Enforces HTTPS and non-www domain (teamshotspro.com).
 */
export function constructMetadata({
    baseUrl,
    path = '',
    title,
    description,
    image,
    locale = 'en',
    noIndex = false,
    siteName,
}: ConstructMetadataParams): Metadata {
    // Ensure path starts with slash if not empty
    const cleanPath = path.startsWith('/') ? path : `/${path}`

    // Construct canonical URL (always HTTPS, uses passed baseUrl, always English path structure for default)
    // detailed logic:
    // - en: https://domain.com/path
    // - es: https://domain.com/es/path
    const canonicalUrl = locale === 'en'
        ? `${baseUrl}${cleanPath}`
        : `${baseUrl}/${locale}${cleanPath}`

    // Default og:image to the brand image if not provided
    const ogImage = image || `${baseUrl}/branding/og-image.jpg`

    // Derive site name from baseUrl if not provided
    const derivedSiteName = siteName || baseUrl.replace(/^https?:\/\//, '').replace(/:\d+$/, '').split('.')[0]
    const displaySiteName = derivedSiteName.charAt(0).toUpperCase() + derivedSiteName.slice(1)

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            url: canonicalUrl,
            siteName: displaySiteName,
            type: 'website',
            locale: locale === 'es' ? 'es_ES' : 'en_US',
            images: [
                {
                    url: ogImage,
                    width: 1200,
                    height: 630,
                    alt: title,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [ogImage],
        },
        alternates: {
            canonical: canonicalUrl,
            languages: {
                'en': `${baseUrl}${cleanPath}`,
                'es': `${baseUrl}/es${cleanPath}`,
            },
        },
        robots: {
            index: !noIndex,
            follow: !noIndex,
        },
    }
}

/**
 * Helper for dynamic blog posts where slugs might differ by language
 */
export function constructBlogMetadata({
    baseUrl,
    enSlug,
    esSlug,
    locale,
    title,
    description,
    image,
}: {
    baseUrl: string
    enSlug: string
    esSlug?: string // Optional, falls back to enSlug if not provided
    locale: string
    title: string
    description?: string
    image?: string
}): Metadata {
    const currentSlug = locale === 'en' ? enSlug : (esSlug || enSlug)
    const path = `/blog/${currentSlug}`

    const currentUrl = locale === 'en'
        ? `${baseUrl}/blog/${enSlug}`
        : `${baseUrl}/${locale}/blog/${currentSlug}`

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            url: currentUrl,
            images: image ? [{ url: image }] : undefined,
        },
        alternates: {
            canonical: currentUrl,
            languages: {
                'en': `${baseUrl}/blog/${enSlug}`,
                'es': `${baseUrl}/es/blog/${esSlug || enSlug}`,
            },
        },
    }
}
