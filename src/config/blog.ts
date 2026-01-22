import type { LandingVariant } from '@/config/landing-content'

/** Localized metadata type for blog posts */
export type PostMeta = {
  en: { title: string; description: string }
  es: { title: string; description: string }
}

export type BlogPostCategory =
  | 'teams'
  | 'hr'
  | 'linkedin'
  | 'personal-branding'
  | 'comparisons'
  | 'guides'

export type BlogPost = {
  slug: string
  /** Which landing variant(s) are allowed to publish this post */
  allowedVariants: readonly LandingVariant[]
  /** Optional: used by the blog index for grouping/filtering */
  category: BlogPostCategory
  /** Title for the blog post card (fallback if no meta) */
  title: string
  /** Short description for the blog post card (fallback if no meta) */
  description: string
  /** Localized metadata imported from the blog post page */
  meta?: PostMeta
  /** Publication date */
  date?: string
  /** Estimated read time */
  readTime?: string
  /** Featured image for the blog post */
  image?: string
  /** Alt text for the featured image (accessibility) */
  imageAlt?: string
  /** Author name */
  author?: string
  /** Whether this post should be featured (hero section) */
  featured?: boolean
}

/** Helper to get localized blog post title */
export function getBlogPostTitle(post: BlogPost, locale: string): string {
  if (post.meta) {
    const l = locale === 'es' ? 'es' : 'en'
    return post.meta[l].title
  }
  return post.title
}

/** Helper to get localized blog post description */
export function getBlogPostDescription(post: BlogPost, locale: string): string {
  if (post.meta) {
    const l = locale === 'es' ? 'es' : 'en'
    return post.meta[l].description
  }
  return post.description
}

/** Category display configuration with localized labels */
export const BLOG_CATEGORIES: Record<BlogPostCategory, { label: { en: string; es: string }; color: string }> = {
  teams: { label: { en: 'Teams', es: 'Equipos' }, color: 'bg-blue-100 text-blue-800' },
  hr: { label: { en: 'HR', es: 'RRHH' }, color: 'bg-purple-100 text-purple-800' },
  linkedin: { label: { en: 'LinkedIn', es: 'LinkedIn' }, color: 'bg-sky-100 text-sky-800' },
  'personal-branding': { label: { en: 'Personal Branding', es: 'Marca Personal' }, color: 'bg-amber-100 text-amber-800' },
  comparisons: { label: { en: 'Comparisons', es: 'Comparaciones' }, color: 'bg-green-100 text-green-800' },
  guides: { label: { en: 'Guides', es: 'Guías' }, color: 'bg-rose-100 text-rose-800' },
}

/** Helper to get localized category label */
export function getCategoryLabel(category: BlogPostCategory, locale: string): string {
  const l = locale === 'es' ? 'es' : 'en'
  return BLOG_CATEGORIES[category].label[l]
}

/** Helper to format read time with locale */
export function formatReadTime(minutes: number, locale: string): string {
  if (locale === 'es') {
    return `${minutes} min de lectura`
  }
  return `${minutes} min read`
}

/**
 * Static blog posts configuration (legacy fallback)
 *
 * All blog posts are now stored in the CMS database.
 * This array is kept empty as a fallback for the blog index page.
 * New posts should be added via the CMS, not here.
 */
export const BLOG_POSTS: readonly BlogPost[] = []

export function isKnownBlogSlug(slug: string): boolean {
  return BLOG_POSTS.some((p) => p.slug === slug)
}

export function isBlogPostAllowedForVariant(variant: LandingVariant, slug: string): boolean {
  const post = BLOG_POSTS.find((p) => p.slug === slug)
  if (!post) return false
  return post.allowedVariants.includes(variant)
}

export function getBlogSlugsForVariant(variant: LandingVariant): string[] {
  return BLOG_POSTS.filter((p) => p.allowedVariants.includes(variant)).map((p) => p.slug)
}
