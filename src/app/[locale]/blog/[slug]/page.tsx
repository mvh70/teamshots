import type { Metadata } from 'next'
import { constructMetadata } from '@/lib/seo'
import { notFound, permanentRedirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getBrand } from '@/config/brand'
import { getLandingVariant } from '@/config/landing-content'
import { BlogPostTemplate, type BlogPostContent } from '@/components/blog'
import {
  getBlogPostBySlug,
  getAllBlogSlugs,
  getRedirectForSlug,
  variantToBrandId,
} from '@/lib/cms'

// Force dynamic rendering since we use headers() and read from CMS database
export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ locale: string; slug: string }>
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
  const headersList = await headers()

  // Get brand ID from domain
  const host = headersList.get('x-forwarded-host') || headersList.get('host')
  const domain = host ? host.split(':')[0].replace(/^www\./, '').toLowerCase() : undefined
  const variant = getLandingVariant(domain)
  const brandId = variantToBrandId(variant)

  const redirectSlug = getRedirectForSlug(brandId, slug)
  if (redirectSlug && redirectSlug !== slug) {
    permanentRedirect(`/${locale}/blog/${redirectSlug}`)
  }

  const post = getBlogPostBySlug(brandId, slug, locale)

  if (!post) {
    // If redirect exists, metadata won't be used (redirect happens in page component)
    return { title: 'Not Found' }
  }

  // Check if Spanish translation is available
  const spanishAvailable = post.spanishStatus === 'published' || post.spanishStatus === 'approved'

  // Use Spanish or English metadata based on locale
  const title = locale === 'es' && post.spanishTitle ? post.spanishTitle : post.title
  const description = locale === 'es' && post.spanishDescription ? post.spanishDescription : post.metaDescription

  const protocol = headersList.get('x-forwarded-proto') || 'https'
  const baseUrl = host ? `${protocol}://${host}` : 'https://teamshotspro.com'

  const baseMetadata = constructMetadata({
    baseUrl,
    path: `/blog/${slug}`,
    locale,
    title,
    description,
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
 * Convert markdown to HTML (basic conversion)
 */
function markdownToHtml(markdown: string): string {
  // Normalize line endings
  let result = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Strip leading H1 - the template already renders the title as H1
  result = result.replace(/^# .+\n+/, '')

  // Remove schema markup comments and scripts (they shouldn't be rendered)
  result = result.replace(/<!--\s*COMPARISON_SCHEMA_START\s*-->[\s\S]*?<\/script>\s*/g, '')
  result = result.replace(/<!--\s*COMPARISON_SCHEMA_END\s*-->/g, '')

  // Convert markdown tables to HTML tables first (before other processing)
  result = result.replace(
    /^\|(.+)\|\s*\n\|[\s\-:|]+\|\s*\n((?:\|.+\|\s*\n?)+)/gm,
    (match, headerRow, bodyRows) => {
      const headers = headerRow.split('|').map((h: string) => h.trim()).filter(Boolean)
      const rows = bodyRows.trim().split('\n').map((row: string) =>
        row.split('|').map((cell: string) => cell.trim()).filter(Boolean)
      )

      let table = '<table class="w-full border-collapse my-6 text-sm"><thead><tr>'
      headers.forEach((h: string) => {
        table += `<th class="border border-gray-300 bg-gray-100 px-4 py-2 text-left font-semibold">${h}</th>`
      })
      table += '</tr></thead><tbody>'
      rows.forEach((row: string[]) => {
        table += '<tr>'
        row.forEach((cell: string) => {
          table += `<td class="border border-gray-300 px-4 py-2">${cell}</td>`
        })
        table += '</tr>'
      })
      table += '</tbody></table>'
      return table + '\n'
    }
  )

  // Convert horizontal rules (--- on its own line) to <hr>
  result = result.replace(/^---$/gm, '<hr class="my-8 border-gray-300" />')

  const escapeAttribute = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Before/after image pairs (two consecutive images with before:/after: alt text)
  result = result.replace(
    /!\[before:\s*([^\]]+)\]\(([^)]+)\)\s*\n!\[after:\s*([^\]]+)\]\(([^)]+)\)/gi,
    (_match, beforeAlt, beforeSrc, afterAlt, afterSrc) =>
      `\n\n<div data-before-src=\"${escapeAttribute(beforeSrc.trim())}\" data-after-src=\"${escapeAttribute(afterSrc.trim())}\" data-before-alt=\"${escapeAttribute(beforeAlt.trim())}\" data-after-alt=\"${escapeAttribute(afterAlt.trim())}\"></div>\n\n`
  )

  // Single images
  result = result.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (_match, alt, src) =>
      `<img src=\"${escapeAttribute(src.trim())}\" alt=\"${escapeAttribute(alt.trim())}\" class=\"w-full rounded-lg border border-gray-200 mb-6\" />`
  )

  const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  return result
    // Headers
    .replace(/^### (.*$)/gm, (_, t) => `<h3 id="${slugify(t)}" class="text-xl font-semibold mt-6 mb-3">${t}</h3>`)
    .replace(/^## (.*$)/gm, (_, t) => `<h2 id="${slugify(t)}" class="text-2xl font-bold mt-8 mb-4">${t}</h2>`)
    .replace(/^# (.*$)/gm, (_, t) => `<h1 id="${slugify(t)}" class="text-3xl font-bold mt-8 mb-4">${t}</h1>`)
    // Bold and italic
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-indigo-600 hover:underline">$1</a>')
    // Lists (markdown "- " and unicode "• " bullets)
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/^• (.*$)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul class="list-disc pl-6 mb-4">$&</ul>')
    // Blockquotes
    .replace(/^> (.*$)/gm, '<blockquote class="border-l-4 border-indigo-500 pl-4 italic text-gray-600">$1</blockquote>')
    // Paragraphs (lines that don't start with tags)
    .split('\n\n')
    .map((block) => {
      if (block.trim().startsWith('<')) return block
      if (block.trim() === '') return ''
      return `<p class="mb-4">${block}</p>`
    })
    .join('\n')
}

/**
 * Blog post page - renders content from CMS database
 */
export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params
  const headersList = await headers()
  const brandConfig = getBrand(headersList)
  const brandCta = brandConfig.cta

  // Get brand ID from domain
  const host = headersList.get('x-forwarded-host') || headersList.get('host')
  const domain = host ? host.split(':')[0].replace(/^www\./, '').toLowerCase() : undefined
  const variant = getLandingVariant(domain)
  const brandId = variantToBrandId(variant)

  // Get blog post from CMS
  const redirectSlug = getRedirectForSlug(brandId, slug)
  if (redirectSlug && redirectSlug !== slug) {
    permanentRedirect(`/${locale}/blog/${redirectSlug}`)
  }

  const post = getBlogPostBySlug(brandId, slug, locale)

  if (!post) {
    // Check if this slug has been consolidated/redirected
    const fallbackRedirectSlug = getRedirectForSlug(brandId, slug)
    if (fallbackRedirectSlug) {
      permanentRedirect(`/${locale}/blog/${fallbackRedirectSlug}`)
    }
    notFound()
  }

  // If requesting Spanish but translation isn't published, show 404
  const spanishAvailable = post.spanishStatus === 'published' || post.spanishStatus === 'approved'
  if (locale === 'es' && !spanishAvailable) {
    notFound()
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
        src: `/api/cms/images${post.heroImagePath}`,
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
