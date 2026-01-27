import { Metadata } from 'next'
import { routing } from '@/i18n/routing'

export const BASE_URL = 'https://teamshotspro.com'

type ConstructMetadataParams = {
    path?: string      // e.g. "/pricing" or "/blog/my-post"
    title: string
    description?: string
    image?: string
    locale?: string    // Current locale
    noIndex?: boolean
}

/**
 * Helper to construct consistent SEO metadata with proper canonicals and hreflangs.
 * Enforces HTTPS and non-www domain (teamshotspro.com).
 */
export function constructMetadata({
    path = '',
    title,
    description,
    image,
    locale = 'en',
    noIndex = false,
}: ConstructMetadataParams): Metadata {
    // Ensure path starts with slash if not empty
    const cleanPath = path.startsWith('/') ? path : `/${path}`

    // Construct canonical URL (always HTTPS, always teamshotspro.com, always English path structure for default)
    // detailed logic:
    // - en: https://teamshotspro.com/path
    // - es: https://teamshotspro.com/es/path
    const canonicalUrl = locale === 'en'
        ? `${BASE_URL}${cleanPath}`
        : `${BASE_URL}/${locale}${cleanPath}`

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            url: canonicalUrl,
            images: image ? [{ url: image }] : undefined,
        },
        alternates: {
            canonical: canonicalUrl,
            languages: {
                'en': `${BASE_URL}${cleanPath}`,
                'es': `${BASE_URL}/es${cleanPath}`,
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
    enSlug,
    esSlug,
    locale,
    title,
    description,
    image,
}: {
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
        ? `${BASE_URL}/blog/${enSlug}`
        : `${BASE_URL}/${locale}/blog/${currentSlug}`

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
                'en': `${BASE_URL}/blog/${enSlug}`,
                'es': `${BASE_URL}/es/blog/${esSlug || enSlug}`,
            },
        },
    }
}
