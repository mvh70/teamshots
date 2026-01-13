import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { BLOG_POSTS, isKnownBlogSlug } from '@/config/blog'

type Props = {
  params: Promise<{ locale: string; slug: string }>
}

const POST_MODULES: Record<
  string,
  () => Promise<{
    default: (props: { params: Promise<{ locale: string }> }) => Promise<JSX.Element>
    generateMetadata?: (props: { params: Promise<{ locale: string }> }) => Promise<Metadata>
  }>
> = {
  'ai-headshots-for-linkedin': () => import('../ai-headshots-for-linkedin/page'),
  'best-ai-headshot-generators': () => import('../best-ai-headshot-generators/page'),
  'corporate-ai-headshots': () => import('../corporate-ai-headshots/page'),
  'free-ai-headshot-generator': () => import('../free-ai-headshot-generator/page'),
  'free-vs-paid-ai-headshots': () => import('../free-vs-paid-ai-headshots/page'),
  'headshot-ai-generator': () => import('../headshot-ai-generator/page'),
  'professional-headshot-photography-cost': () => import('../professional-headshot-photography-cost/page'),
  'professional-headshots-ai': () => import('../professional-headshots-ai/page'),
  'remote-onboarding-broken': () => import('../remote-onboarding-broken/page'),
}

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    BLOG_POSTS.map((p) => ({
      locale,
      slug: p.slug,
    })),
  )
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isKnownBlogSlug(slug) || !POST_MODULES[slug]) {
    notFound()
  }

  const mod = await POST_MODULES[slug]()
  if (mod.generateMetadata) {
    return mod.generateMetadata({ params: Promise.resolve({ locale }) })
  }

  // Safe fallback (should not happen for current post pages)
  return {
    title: 'Blog post',
    alternates: {
      canonical: `${locale === 'es' ? '/es' : ''}/blog/${slug}`,
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params
  if (!isKnownBlogSlug(slug) || !POST_MODULES[slug]) {
    notFound()
  }

  const mod = await POST_MODULES[slug]()
  return mod.default({ params: Promise.resolve({ locale }) })
}

