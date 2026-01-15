import type { LandingVariant } from '@/config/landing-content'

// Import metadata from blog posts (separate meta.ts files to avoid client/server conflicts)
import { postMeta as averageCostMeta } from '@/app/[locale]/blog/average-cost-professional-headshots/meta'
import { postMeta as corporateAiHeadshotsMeta } from '@/app/[locale]/blog/corporate-ai-headshots/meta'
import { postMeta as remoteOnboardingMeta } from '@/app/[locale]/blog/remote-onboarding-broken/meta'

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

/** Category display configuration */
export const BLOG_CATEGORIES: Record<BlogPostCategory, { label: string; color: string }> = {
  teams: { label: 'Teams', color: 'bg-blue-100 text-blue-800' },
  hr: { label: 'HR', color: 'bg-purple-100 text-purple-800' },
  linkedin: { label: 'LinkedIn', color: 'bg-sky-100 text-sky-800' },
  'personal-branding': { label: 'Personal Branding', color: 'bg-amber-100 text-amber-800' },
  comparisons: { label: 'Comparisons', color: 'bg-green-100 text-green-800' },
  guides: { label: 'Guides', color: 'bg-rose-100 text-rose-800' },
}

/**
 * Content silos to avoid duplicate-content penalties across domains.
 *
 * Rule of thumb:
 * - teamshotspro: HR, management, remote culture, team consistency
 * - individualshots: personal branding, LinkedIn, job hunting
 * - rightclickfit: fashion, shopping, style (none yet)
 * - coupleshots / familyshots: seasonal lifestyle (none yet)
 */
export const BLOG_POSTS: readonly BlogPost[] = [
  {
    slug: 'average-cost-professional-headshots',
    allowedVariants: ['teamshotspro'],
    category: 'guides',
    title: averageCostMeta.en.title,
    description: averageCostMeta.en.description,
    meta: averageCostMeta,
    date: '2026-01-14',
    readTime: '12 min read',
    author: 'TeamShotsPro Team',
    image: '/blog/average-cost-professional-headshots.png?v=1768472977464',
    imageAlt: 'HR director laughing at cost savings on tablet while a photography crew struggles with heavy expensive gear in the background.',
  },
  // TeamShotsPro silo (B2B)
  {
    slug: 'corporate-ai-headshots',
    allowedVariants: ['teamshotspro'],
    category: 'teams',
    title: corporateAiHeadshotsMeta.en.title,
    description: corporateAiHeadshotsMeta.en.description,
    meta: corporateAiHeadshotsMeta,
    date: '2025-01-10',
    readTime: '8 min read',
    author: 'TeamShotsPro Team',
    featured: true,
    image: '/blog/corporate-ai-headshots.png?v=1768472921672',
    imageAlt: 'HR manager triumphantly holding up a tablet with AI headshots in a lush greenhouse cafe, celebrating effortless remote team coordination.',
  },
  {
    slug: 'remote-onboarding-broken',
    allowedVariants: ['teamshotspro'],
    category: 'hr',
    title: remoteOnboardingMeta.en.title,
    description: remoteOnboardingMeta.en.description,
    meta: remoteOnboardingMeta,
    date: '2025-01-08',
    readTime: '6 min read',
    author: 'TeamShotsPro Team',
    image: '/blog/remote-onboarding-broken.png?v=1768472852340',
    imageAlt: 'HR manager laughing on rooftop as wind blows onboarding papers away, symbolizing chaotic remote work logistics',
  },

  // IndividualShots silo (consumer / personal branding)
  {
    slug: 'ai-headshots-for-linkedin',
    allowedVariants: ['individualshots'],
    category: 'linkedin',
    title: 'AI Headshots for LinkedIn: Complete 2025 Guide',
    description:
      'Professional AI headshots for LinkedIn profiles. Compare top tools, pricing, and quality. Get a standout profile photo in minutes.',
    date: '2025-01-12',
    readTime: '7 min read',
    author: 'PhotoShotsPro Team',
    featured: true,
  },
  {
    slug: 'professional-headshot-photography-cost',
    allowedVariants: ['individualshots'],
    category: 'guides',
    title: 'Professional Headshot Photography Cost (2026): Team Pricing vs. AI',
    description:
      'Save 90% on Team Sessions. Complete professional headshot pricing guide: individual sessions ($100-500) to corporate groups ($30-75/person). Compare with AI alternatives.',
    date: '2026-01-14',
    readTime: '6 min read',
    author: 'PhotoShotsPro Team',
  },
  {
    slug: 'free-vs-paid-ai-headshots',
    allowedVariants: ['individualshots'],
    category: 'comparisons',
    title: 'Free vs Paid AI Headshots: Which Should You Use?',
    description:
      'Honest comparison of free and paid AI headshot generators. Quality differences, limitations, and when to upgrade.',
    date: '2025-01-09',
    readTime: '5 min read',
    author: 'PhotoShotsPro Team',
  },
  {
    slug: 'best-ai-headshot-generators',
    allowedVariants: ['individualshots'],
    category: 'comparisons',
    title: 'Best AI Headshot Generators in 2025 (Compared & Reviewed)',
    description:
      'We tested the top AI headshot generators for quality, speed, and price. HeadshotPro, BetterPic, Aragon AI compared.',
    date: '2025-01-13',
    readTime: '9 min read',
    author: 'PhotoShotsPro Team',
  },
  {
    slug: 'free-ai-headshot-generator',
    allowedVariants: ['individualshots'],
    category: 'guides',
    title: 'Free AI Headshot Generator: Best Options in 2025',
    description:
      'Looking for a free AI headshot generator? Compare quality, limits, and features. Plus when to consider paid options.',
    date: '2025-01-07',
    readTime: '6 min read',
    author: 'PhotoShotsPro Team',
  },
  {
    slug: 'professional-headshots-ai',
    allowedVariants: ['individualshots'],
    category: 'guides',
    title: 'Professional Headshots with AI: Complete 2025 Guide',
    description:
      'How to get professional-quality headshots using AI. Best practices, tool comparisons, and what to avoid.',
    date: '2025-01-06',
    readTime: '8 min read',
    author: 'PhotoShotsPro Team',
  },
  {
    slug: 'headshot-ai-generator',
    allowedVariants: ['individualshots'],
    category: 'guides',
    title: 'Headshot AI Generator: How It Works & Best Tools 2025',
    description:
      'Everything you need to know about AI headshot generators. How they work, quality expectations, and top tools compared.',
    date: '2025-01-05',
    readTime: '7 min read',
    author: 'PhotoShotsPro Team',
  },
]

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

