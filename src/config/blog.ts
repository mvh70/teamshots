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
  { slug: 'corporate-ai-headshots', allowedVariants: ['teamshotspro'], category: 'teams' },
  { slug: 'remote-onboarding-broken', allowedVariants: ['teamshotspro'], category: 'hr' },

  // IndividualShots silo (consumer / personal branding)
  { slug: 'ai-headshots-for-linkedin', allowedVariants: ['individualshots'], category: 'linkedin' },
  { slug: 'professional-headshot-photography-cost', allowedVariants: ['individualshots'], category: 'guides' },
  { slug: 'free-vs-paid-ai-headshots', allowedVariants: ['individualshots'], category: 'comparisons' },
  { slug: 'best-ai-headshot-generators', allowedVariants: ['individualshots'], category: 'comparisons' },
  { slug: 'free-ai-headshot-generator', allowedVariants: ['individualshots'], category: 'guides' },
  { slug: 'professional-headshots-ai', allowedVariants: ['individualshots'], category: 'guides' },
  { slug: 'headshot-ai-generator', allowedVariants: ['individualshots'], category: 'guides' },
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

