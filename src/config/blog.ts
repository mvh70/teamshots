import type { LandingVariant } from '@/config/landing-content'

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
  /** Title for the blog post card */
  title: string
  /** Short description for the blog post card */
  description: string
  /** Publication date */
  date?: string
  /** Estimated read time */
  readTime?: string
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
  // TeamShotsPro silo (B2B)
  {
    slug: 'corporate-ai-headshots',
    allowedVariants: ['teamshotspro'],
    category: 'teams',
    title: 'Corporate AI Headshots: 2025 Guide for Remote Teams & HR',
    description:
      'Complete guide to corporate AI headshots in 2025. Save 80-90% vs. photographers with consistent, professional results for teams. Best practices and tools.',
    date: '2025-01-10',
    readTime: '8 min read',
  },
  {
    slug: 'remote-onboarding-broken',
    allowedVariants: ['teamshotspro'],
    category: 'hr',
    title: "Remote Onboarding Is Broken (Here's How AI Headshots Fix It)",
    description:
      'Why remote onboarding feels disconnected and how AI headshots create consistency for distributed teams. Practical guide for HR professionals.',
    date: '2025-01-08',
    readTime: '6 min read',
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
  },
  {
    slug: 'professional-headshot-photography-cost',
    allowedVariants: ['individualshots'],
    category: 'guides',
    title: 'Professional Headshot Photography Cost in 2025',
    description:
      'What do professional headshots cost in 2025? Compare traditional photography vs AI headshots. Pricing guide and value breakdown.',
    date: '2025-01-11',
    readTime: '6 min read',
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

