import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { getBrand } from '@/config/brand'
import { getBaseUrl } from '@/lib/url'
import { getLandingVariant } from '@/config/landing-content'
import { BlogPostTemplate, type BlogPostContent } from '@/components/blog'
import {
  getBlogPostBySlug,
  getAllBlogSlugs,
  variantToBrandId,
} from '@/lib/cms'

// Force dynamic rendering since we use headers() and read from CMS database
export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ locale: string; slug: string }>
}

/**
 * Generate static params for all blog posts from CMS
 * Note: With dynamic = 'force-dynamic', this serves as a hint for which paths exist
 * but pages are still rendered dynamically on each request.
 */
export async function generateStaticParams() {
  const params: Array<{ locale: string; slug: string }> = []

  // Get slugs for each brand
  const brands = ['teamshots-pro', 'headshot-one']

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
  const brandConfig = getBrand(headersList)

  // Get brand ID from domain
  const host = headersList.get('host') || headersList.get('x-forwarded-host')
  const domain = host ? host.split(':')[0].replace(/^www\./, '').toLowerCase() : undefined
  const variant = getLandingVariant(domain)
  const brandId = variantToBrandId(variant)

  const post = getBlogPostBySlug(brandId, slug, locale)

  if (!post) {
    return { title: 'Not Found' }
  }

  // Check if Spanish translation is available
  const spanishAvailable = post.spanishStatus === 'published' || post.spanishStatus === 'approved'

  // Use Spanish or English metadata based on locale
  const title = locale === 'es' && post.spanishTitle ? post.spanishTitle : post.title
  const description = locale === 'es' && post.spanishDescription ? post.spanishDescription : post.metaDescription

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      publishedTime: post.publishedAt || undefined,
      authors: ['Matthieu van Haperen'],
    },
    alternates: {
      canonical: locale === 'es' ? `/es/blog/${slug}` : `/blog/${slug}`,
      languages: spanishAvailable
        ? {
            en: `/blog/${slug}`,
            es: `/es/blog/${slug}`,
          }
        : {
            en: `/blog/${slug}`,
          },
    },
  }
}

/**
 * Convert markdown to HTML (basic conversion)
 */
function markdownToHtml(markdown: string): string {
  return markdown
    // Headers
    .replace(/^### (.*$)/gm, '<h3 class="text-xl font-semibold mt-6 mb-3">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-2xl font-bold mt-8 mb-4">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="text-3xl font-bold mt-8 mb-4">$1</h1>')
    // Bold and italic
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-indigo-600 hover:underline">$1</a>')
    // Lists
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul class="list-disc pl-6 mb-4">$&</ul>')
    // Tables (basic)
    .replace(/\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|/g, (match, c1, c2, c3, c4) => {
      if (c1.includes('---')) return '' // Skip separator row
      return `<tr><td class="border border-gray-200 p-2">${c1.trim()}</td><td class="border border-gray-200 p-2">${c2.trim()}</td><td class="border border-gray-200 p-2">${c3.trim()}</td><td class="border border-gray-200 p-2">${c4.trim()}</td></tr>`
    })
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
  const baseUrl = getBaseUrl(headersList)

  // Get brand ID from domain
  const host = headersList.get('host') || headersList.get('x-forwarded-host')
  const domain = host ? host.split(':')[0].replace(/^www\./, '').toLowerCase() : undefined
  const variant = getLandingVariant(domain)
  const brandId = variantToBrandId(variant)

  // Get blog post from CMS
  const post = getBlogPostBySlug(brandId, slug, locale)

  if (!post) {
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

  // Build BlogPostContent
  const content: BlogPostContent = {
    slug: post.slug,
    locale,
    title,
    description,
    breadcrumb: title.length > 40 ? title.substring(0, 40) + '...' : title,
    content: htmlContent,
    faqs,
    faqTitle: locale === 'es' ? 'Preguntas Frecuentes' : 'Frequently Asked Questions',
    heroImage: post.heroImagePath
      ? {
          alt: title,
          caption: { en: '', es: '' },
          src: `/api/cms/images${post.heroImagePath}`,
        }
      : undefined,
    datePublished: post.publishedAt || new Date().toISOString(),
    author: {
      name: 'Matthieu van Haperen',
      title: locale === 'es' ? `Fundador, ${brandConfig.name}` : `Founder, ${brandConfig.name}`,
      bio:
        locale === 'es'
          ? `Matthieu van Haperen es el fundador de ${brandConfig.name} y un ex venture builder con más de 6 años de experiencia en startups.`
          : `Matthieu van Haperen is the founder of ${brandConfig.name} and a former venture builder with 6+ years of startup experience.`,
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
      button: locale === 'es' ? `Prueba ${brandConfig.name} Gratis →` : `Try ${brandConfig.name} Free →`,
      href: '/',
    },
  }

  return (
    <article>
      <BlogPostTemplate content={content} />
    </article>
  )
}
