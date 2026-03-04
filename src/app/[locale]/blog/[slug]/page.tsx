import type { Metadata } from 'next'
import { constructBlogMetadata } from '@/lib/seo'
import { normalizeBaseUrlForSeo } from '@/lib/url'
import { notFound, permanentRedirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getBrandByDomain } from '@/config/brand'
import { getTenant } from '@/config/tenant-server'
import { BlogPostTemplate, type BlogPostContent } from '@/components/blog'
import { markdownToHtml } from '@/lib/markdown'
import {
  getBlogPostBySlug,
  getBlogPostBySpanishSlug,
  getAllBlogSlugs,
  getRedirectForSlug,
} from '@/lib/cms'

// Force dynamic rendering since we use headers() and read from CMS database
export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ locale: string; slug: string }>
}

function hasPublishedSpanishTranslation(status: string | null | undefined): boolean {
  return status === 'published' || status === 'approved'
}

/** Build a blog redirect path that avoids the /en/ prefix (which creates a redirect chain with next.config). */
function blogPath(locale: string, slug: string): string {
  return locale === 'en' ? `/blog/${slug}` : `/${locale}/blog/${slug}`
}

function normalizeIsoDate(
  dateValue: string | number | Date | null | undefined
): string | undefined {
  if (!dateValue) return undefined

  if (dateValue instanceof Date) {
    return Number.isNaN(dateValue.getTime()) ? undefined : dateValue.toISOString()
  }

  if (typeof dateValue === 'number') {
    const parsed = new Date(dateValue > 1_000_000_000_000 ? dateValue : dateValue * 1000)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
  }

  if (typeof dateValue !== 'string') return undefined

  const value = dateValue.trim()
  if (!value) return undefined

  if (/^\d{13}$/.test(value)) {
    const parsed = new Date(Number(value))
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
  }

  if (/^\d{10}$/.test(value)) {
    const parsed = new Date(Number(value) * 1000)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

/**
 * Generate static params for all blog posts from CMS
 * Note: With dynamic = 'force-dynamic', this serves as a hint for which paths exist
 * but pages are still rendered dynamically on each request.
 */
export async function generateStaticParams() {
  const params: Array<{ locale: string; slug: string }> = []

  // Get slugs for each brand that may have blog content
  const brands = ['teamshotspro', 'headshot-one', 'portreya', 'duo-snaps', 'kin-frame', 'rightclick-fit']

  for (const brandId of brands) {
    const slugs = getAllBlogSlugs(brandId)
    for (const slug of slugs) {
      // Add English version
      params.push({ locale: 'en', slug })
      // Add Spanish version
      params.push({ locale: 'es', slug })
    }
  }

  return params
}

/**
 * Generate metadata for the blog post
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  const tenant = await getTenant()
  const headersList = await headers()
  const brandId = tenant.cmsBrandId

  // Handle CMS redirects (old/consolidated slugs)
  const redirectSlug = getRedirectForSlug(brandId, slug)
  if (redirectSlug && redirectSlug !== slug) {
    if (locale === 'es') {
      const redirectPost = getBlogPostBySlug(brandId, redirectSlug, locale)
      if (!redirectPost || !hasPublishedSpanishTranslation(redirectPost.spanishStatus)) {
        permanentRedirect(`/blog/${redirectSlug}`)
      }
    }
    permanentRedirect(blogPath(locale, redirectSlug))
  }

  // Look up post by canonical (English) slug
  const post = getBlogPostBySlug(brandId, slug, locale)

  // Fallback: if not found and requesting Spanish, try looking up by Spanish slug
  if (!post && locale === 'es') {
    const spanishMatch = getBlogPostBySpanishSlug(brandId, slug)
    if (spanishMatch) {
      // Redirect to the canonical URL using the English slug
      permanentRedirect(blogPath(locale, spanishMatch.slug))
    }
  }

  if (!post) {
    return { title: 'Not Found' }
  }

  // Check if Spanish translation is available
  const spanishAvailable = hasPublishedSpanishTranslation(post.spanishStatus)
  if (locale === 'es' && !spanishAvailable) {
    permanentRedirect(`/blog/${slug}`)
  }

  // Use Spanish or English metadata based on locale
  const title = locale === 'es' && post.spanishTitle ? post.spanishTitle : post.title
  const description = locale === 'es' && post.spanishDescription ? post.spanishDescription : post.metaDescription

  const protocol = headersList.get('x-forwarded-proto') || 'https'
  const host = headersList.get('x-forwarded-host') || headersList.get('host')
  const baseUrl = host ? `${protocol}://${host}` : `https://${tenant.domain}`

  const heroImageUrl = post.heroImagePath
    ? `${normalizeBaseUrlForSeo(baseUrl)}/images${post.heroImagePath}`
    : undefined

  const baseMetadata = constructBlogMetadata({
    baseUrl,
    enSlug: post.slug,
    esSlug: spanishAvailable ? (post.spanishSlug || post.slug) : undefined,
    locale,
    title,
    description,
    image: heroImageUrl,
  })

  return {
    ...baseMetadata,
    // Override the layout template — blog titles are self-contained and
    // appending "| BrandName" pushes them past Google's ~60-char SERP limit.
    title: { absolute: title },
    openGraph: {
      ...baseMetadata.openGraph,
      type: 'article',
      publishedTime: normalizeIsoDate(post.publishedAt),
      authors: ['Matthieu van Haperen'],
    },
    alternates: {
      ...baseMetadata.alternates,
      languages: spanishAvailable
        ? baseMetadata.alternates!.languages
        : {
          en: baseMetadata.alternates!.languages!['en'],
          'x-default': baseMetadata.alternates!.languages!['en'],
        },
    },
  }
}

/**
 * Blog post page - renders content from CMS database
 */
export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params
  const tenant = await getTenant()
  const brandConfig = getBrandByDomain(tenant.domain)
  const brandCta = brandConfig.cta

  const brandId = tenant.cmsBrandId

  // Handle CMS redirects (old/consolidated slugs)
  const redirectSlug = getRedirectForSlug(brandId, slug)
  if (redirectSlug && redirectSlug !== slug) {
    if (locale === 'es') {
      const redirectPost = getBlogPostBySlug(brandId, redirectSlug, locale)
      if (!redirectPost || !hasPublishedSpanishTranslation(redirectPost.spanishStatus)) {
        permanentRedirect(`/blog/${redirectSlug}`)
      }
    }
    permanentRedirect(blogPath(locale, redirectSlug))
  }

  // Look up post by canonical (English) slug
  const post = getBlogPostBySlug(brandId, slug, locale)

  if (!post) {
    // Fallback: if requesting Spanish, try looking up by Spanish localized slug
    if (locale === 'es') {
      const spanishMatch = getBlogPostBySpanishSlug(brandId, slug)
      if (spanishMatch) {
        permanentRedirect(blogPath(locale, spanishMatch.slug))
      }
    }

    // Check if this slug has been consolidated/redirected
    const fallbackRedirectSlug = getRedirectForSlug(brandId, slug)
    if (fallbackRedirectSlug) {
      if (locale === 'es') {
        const fallbackPost = getBlogPostBySlug(brandId, fallbackRedirectSlug, locale)
        if (!fallbackPost || !hasPublishedSpanishTranslation(fallbackPost.spanishStatus)) {
          permanentRedirect(`/blog/${fallbackRedirectSlug}`)
        }
      }
      permanentRedirect(blogPath(locale, fallbackRedirectSlug))
    }
    notFound()
  }

  // If requesting Spanish but translation isn't published, redirect to English
  const spanishAvailable = hasPublishedSpanishTranslation(post.spanishStatus)
  if (locale === 'es' && !spanishAvailable) {
    permanentRedirect(`/blog/${slug}`)
  }

  // Get content based on locale
  const title = locale === 'es' && post.spanishTitle ? post.spanishTitle : post.title
  const description = locale === 'es' && post.spanishDescription ? post.spanishDescription : post.metaDescription
  const rawContent = locale === 'es' && post.spanishContent ? post.spanishContent : post.content

  const ctaButton = locale === 'es' ? (brandCta.primaryTextEs || brandCta.primaryText) : brandCta.primaryText
  const ctaHref = brandCta.pricingHref || brandCta.primaryHref

  // Convert markdown to HTML
  const htmlContent = markdownToHtml(rawContent)

  // Parse FAQs
  let faqs: Array<{ question: string; answer: string }> = []
  const faqsJson = locale === 'es' && post.spanishFaqsJson ? post.spanishFaqsJson : post.faqsJson
  if (faqsJson) {
    try {
      faqs = JSON.parse(faqsJson)
    } catch {
      // Ignore parsing errors
    }
  }

  // Parse TL;DR
  let tldr: string[] | undefined
  if (post.tldrJson) {
    try {
      const parsed = JSON.parse(post.tldrJson)
      if (Array.isArray(parsed)) {
        tldr = parsed.filter((item) => typeof item === 'string' && item.trim().length > 0)
      }
    } catch {
      // Ignore parsing errors
    }
  }

  // Build BlogPostContent
  const content: BlogPostContent = {
    slug: post.slug,
    locale,
    title,
    description,
    breadcrumb: title.length > 40 ? title.substring(0, 40) + '...' : title,
    content: htmlContent,
    tldr,
    faqs,
    faqTitle: locale === 'es' ? 'Preguntas Frecuentes' : 'Frequently Asked Questions',
    heroImage: post.heroImagePath
      ? {
        alt: title,
        caption: { en: '', es: '' },
        src: `/images${post.heroImagePath}`,
      }
      : undefined,
    datePublished: normalizeIsoDate(post.publishedAt) || new Date().toISOString(),
    author: {
      name: 'Matthieu van Haperen',
      title: locale === 'es' ? `Fundador y CEO, ${brandConfig.name}` : `Founder & CEO, ${brandConfig.name}`,
      bio:
        locale === 'es'
          ? `Matthieu van Haperen dirige ${brandConfig.name}, donde ha ayudado a cientos de equipos a obtener headshots profesionales con IA. Antes de fundar ${brandConfig.name}, pasó más de 6 años construyendo y escalando startups tecnológicas. Escribe sobre fotografía profesional, branding de equipos y cómo la IA está transformando la imagen corporativa.`
          : `Matthieu van Haperen runs ${brandConfig.name}, where he has helped hundreds of teams get professional AI headshots. Before founding ${brandConfig.name}, he spent 6+ years building and scaling tech startups. He writes about professional photography, team branding, and how AI is reshaping corporate imagery.`,
      linkedInUrl: 'https://linkedin.com/in/matthieuvanhaperen',
      initials: 'MH',
    },
    cta: {
      title:
        locale === 'es'
          ? `¿Listo para comenzar con ${brandConfig.name}?`
          : `Ready to get started with ${brandConfig.name}?`,
      description:
        locale === 'es'
          ? 'Genera headshots profesionales con IA en 60 segundos.'
          : 'Generate professional AI headshots in 60 seconds.',
      button: ctaButton,
      href: ctaHref,
    },
    // Use pre-generated schema from CMS if available
    schemaJson: post.schemaJson || undefined,
  }

  return (
    <article>
      <BlogPostTemplate content={content} />
    </article>
  )
}
