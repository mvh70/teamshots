/**
 * CMS Database Access
 *
 * Reads published content from the CMS database (teamshots-marketing).
 * Used by blog index and sitemap to dynamically list published content.
 */
import Database from 'better-sqlite3'
import path from 'path'
import type { LandingVariant } from '@/config/landing-content'
import type { BlogPost, BlogPostCategory } from '@/config/blog'

// Path to the CMS database (relative to project root)
const CMS_DB_PATH = path.join(
  process.cwd(),
  '..',
  'teamshots-marketing',
  'prisma',
  'cms.db'
)

// Fallback for production - use environment variable
const DB_PATH = process.env.CMS_DATABASE_PATH || CMS_DB_PATH

export type CMSBlogPost = {
  slug: string
  title: string
  metaDescription: string
  heroImagePath: string | null
  publishedAt: string | number | Date | null
  brandId: string
  contentType: string
  category: string | null
  wordCount: number
  // Spanish translation
  spanishSlug: string | null
  spanishTitle: string | null
  spanishDescription: string | null
  spanishStatus: string | null
}

/**
 * Get all published blog posts for a specific brand
 */
export function getPublishedBlogPosts(brandId: string): CMSBlogPost[] {
  try {
    const db = new Database(DB_PATH, { readonly: true })

    const query = `
      SELECT
        cs.canonicalSlug as slug,
        cv.title,
        cv.metaDescription,
        cv.heroImagePath,
        cs.publishedAt,
        cs.brandId,
        cs.contentType,
        cs.category,
        cv.wordCount,
        t.localizedSlug as spanishSlug,
        t.title as spanishTitle,
        t.metaDescription as spanishDescription,
        t.status as spanishStatus
      FROM ContentSeries cs
      INNER JOIN ContentVersion cv ON cv.seriesId = cs.id
      LEFT JOIN Translation t ON t.versionId = cv.id AND t.language = 'es'
      WHERE cs.brandId = ?
        AND cs.contentType = 'blog'
        AND cv.status = 'published'
        AND cs.status != 'archived'
      ORDER BY cs.publishedAt DESC
    `

    const posts = db.prepare(query).all(brandId) as CMSBlogPost[]
    db.close()

    return posts
  } catch (error) {
    console.error('Failed to read CMS database:', error)
    return []
  }
}

/**
 * Get all published solution pages (verticals) for a specific brand
 */
export function getPublishedSolutions(brandId: string): CMSBlogPost[] {
  try {
    const db = new Database(DB_PATH, { readonly: true })

    const query = `
      SELECT
        cs.canonicalSlug as slug,
        cv.title,
        cv.metaDescription,
        cv.heroImagePath,
        cs.publishedAt,
        cs.brandId,
        cs.contentType,
        cv.wordCount,
        t.localizedSlug as spanishSlug,
        t.title as spanishTitle,
        t.status as spanishStatus
      FROM ContentSeries cs
      INNER JOIN ContentVersion cv ON cv.seriesId = cs.id
      LEFT JOIN Translation t ON t.versionId = cv.id AND t.language = 'es'
      WHERE cs.brandId = ?
        AND cs.contentType = 'vertical'
        AND cv.status = 'published'
        AND cs.status != 'archived'
      ORDER BY cs.publishedAt DESC
    `

    const solutions = db.prepare(query).all(brandId) as CMSBlogPost[]
    db.close()

    return solutions
  } catch (error) {
    console.error('Failed to read CMS database:', error)
    return []
  }
}

/**
 * Map landing variant to CMS brand ID
 */
export function variantToBrandId(variant: LandingVariant): string {
  const mapping: Record<LandingVariant, string> = {
    teamshotspro: 'teamshotspro',
    individualshots: 'portreya',
    portreya: 'portreya',
    coupleshots: 'duo-snaps',
    familyshots: 'kin-frame',
    rightclickfit: 'rightclick-fit',
  }
  return mapping[variant] || 'teamshotspro'
}

/**
 * Get all published content slugs for sitemap generation
 */
export function getAllPublishedSlugs(brandId: string): {
  blogSlugs: Array<{ en: string; es: string | null }>
  solutionSlugs: Array<{ en: string; es: string | null }>
} {
  try {
    const db = new Database(DB_PATH, { readonly: true })

    const blogQuery = `
      SELECT
        cs.canonicalSlug as slug,
        t.localizedSlug as spanishSlug
      FROM ContentSeries cs
      INNER JOIN ContentVersion cv ON cv.seriesId = cs.id
      LEFT JOIN Translation t ON t.versionId = cv.id AND t.language = 'es' AND t.status IN ('approved', 'published')
      WHERE cs.brandId = ?
        AND cs.contentType = 'blog'
        AND cv.status = 'published'
        AND cs.status != 'archived'
    `

    const solutionQuery = `
      SELECT
        cs.canonicalSlug as slug,
        t.localizedSlug as spanishSlug
      FROM ContentSeries cs
      INNER JOIN ContentVersion cv ON cv.seriesId = cs.id
      LEFT JOIN Translation t ON t.versionId = cv.id AND t.language = 'es' AND t.status IN ('approved', 'published')
      WHERE cs.brandId = ?
        AND cs.contentType = 'vertical'
        AND cv.status = 'published'
        AND cs.status != 'archived'
    `

    const blogRows = db.prepare(blogQuery).all(brandId) as Array<{
      slug: string
      spanishSlug: string | null
    }>
    const solutionRows = db.prepare(solutionQuery).all(brandId) as Array<{
      slug: string
      spanishSlug: string | null
    }>

    db.close()

    return {
      blogSlugs: blogRows.map((r) => ({ en: r.slug, es: r.spanishSlug })),
      solutionSlugs: solutionRows.map((r) => ({ en: r.slug, es: r.spanishSlug })),
    }
  } catch (error) {
    console.error('Failed to read CMS database for sitemap:', error)
    return { blogSlugs: [], solutionSlugs: [] }
  }
}

/**
 * Estimate read time from word count
 */
function estimateReadTime(wordCount: number): string {
  const wpm = 200 // Average reading speed
  const minutes = Math.ceil(wordCount / wpm)
  return `${minutes} min read`
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
 * Transform CMS heroImagePath to API URL
 * Converts /blog/slug.png → /api/cms/images/blog/slug.png
 */
function heroImageToUrl(heroImagePath: string | null): string | undefined {
  if (!heroImagePath) return undefined
  // heroImagePath is stored as /blog/slug.png or similar
  return `/api/cms/images${heroImagePath}`
}

/**
 * Convert CMS blog post to BlogPost format for use in components
 */
export function cmsToBlogPost(cmsPost: CMSBlogPost, variant: LandingVariant): BlogPost {
  return {
    slug: cmsPost.slug,
    allowedVariants: [variant],
    category: (cmsPost.category || 'guides') as BlogPostCategory,
    title: cmsPost.title,
    description: cmsPost.metaDescription,
    meta: cmsPost.spanishTitle
      ? {
          en: { title: cmsPost.title, description: cmsPost.metaDescription },
          es: { title: cmsPost.spanishTitle, description: cmsPost.spanishDescription || cmsPost.metaDescription },
        }
      : undefined,
    date: normalizeIsoDate(cmsPost.publishedAt),
    readTime: estimateReadTime(cmsPost.wordCount),
    image: heroImageToUrl(cmsPost.heroImagePath),
    author: variant === 'teamshotspro' ? 'TeamShotsPro Team' : 'Portreya Team',
    featured: false, // Could be stored in CMS
  }
}

/**
 * Get published blog posts as BlogPost array for a variant
 * @param variant - The landing variant (brand)
 * @param locale - Optional locale to filter by translation availability
 */
export function getBlogPostsForVariant(variant: LandingVariant, locale?: string): BlogPost[] {
  const brandId = variantToBrandId(variant)
  let cmsPosts = getPublishedBlogPosts(brandId)

  // If Spanish locale, filter to only posts with published/approved Spanish translations
  if (locale === 'es') {
    cmsPosts = cmsPosts.filter(p =>
      p.spanishStatus === 'published' || p.spanishStatus === 'approved'
    )
  }

  return cmsPosts.map((p) => cmsToBlogPost(p, variant))
}

/**
 * Full blog post content for rendering
 */
export type CMSBlogPostFull = {
  slug: string
  title: string
  metaDescription: string
  content: string
  heroImagePath: string | null
  tldrJson: string | null
  comparisonImagePath: string | null
  publishedAt: string | number | Date | null
  brandId: string
  wordCount: number
  faqsJson: string | null
  schemaJson: string | null
  // Spanish translation
  spanishSlug: string | null
  spanishTitle: string | null
  spanishDescription: string | null
  spanishContent: string | null
  spanishFaqsJson: string | null
  spanishStatus: string | null
}

/**
 * Get a single blog post by slug with full content
 */
export function getBlogPostBySlug(brandId: string, slug: string, locale: string): CMSBlogPostFull | null {
  try {
    const db = new Database(DB_PATH, { readonly: true })

    const query = `
      SELECT
        cs.canonicalSlug as slug,
        cv.title,
        cv.metaDescription,
        cv.content,
        cv.heroImagePath,
        cv.tldrJson,
        cv.comparisonImagePath,
        cs.publishedAt,
        cs.brandId,
        cv.wordCount,
        cv.faqsJson,
        cv.schemaJson,
        t.localizedSlug as spanishSlug,
        t.title as spanishTitle,
        t.metaDescription as spanishDescription,
        t.content as spanishContent,
        t.faqsJson as spanishFaqsJson,
        t.status as spanishStatus
      FROM ContentSeries cs
      INNER JOIN ContentVersion cv ON cv.seriesId = cs.id
      LEFT JOIN Translation t ON t.versionId = cv.id AND t.language = 'es'
      WHERE cs.brandId = ?
        AND cs.canonicalSlug = ?
        AND cs.contentType = 'blog'
        AND cv.status = 'published'
        AND cs.status != 'archived'
    `

    const post = db.prepare(query).get(brandId, slug) as CMSBlogPostFull | undefined
    db.close()

    return post || null
  } catch (error) {
    console.error('Failed to read blog post from CMS:', error)
    return null
  }
}

/**
 * Check if a slug has a redirect (e.g. from consolidated/deprecated content)
 * Returns the target slug if a redirect exists, null otherwise.
 */
export function getRedirectForSlug(brandId: string, slug: string): string | null {
  try {
    const db = new Database(DB_PATH, { readonly: true })

    const query = `
      SELECT redirectTo
      FROM ContentMigration
      WHERE brandId = ?
        AND redirectFrom IN (?, ?)
        AND redirectTo IS NOT NULL
        AND redirectTo LIKE '/blog/%'
        AND status = 'complete'
      ORDER BY
        completedAt DESC,
        updatedAt DESC,
        createdAt DESC
      LIMIT 1
    `

    const row = db.prepare(query).get(
      brandId,
      `/blog/${slug}`,
      `/${slug}`
    ) as { redirectTo: string } | undefined
    db.close()

    if (!row) return null

    // redirectTo is typically stored as "/blog/target-slug"; support plain slugs too.
    return row.redirectTo
      .replace(/^\/blog\//, '')
      .replace(/^\//, '')
  } catch (error) {
    console.error('Failed to check redirect for slug:', error)
    return null
  }
}

/**
 * Get all published blog slugs for a brand (for generateStaticParams)
 */
export function getAllBlogSlugs(brandId: string): string[] {
  try {
    const db = new Database(DB_PATH, { readonly: true })

    const query = `
      SELECT cs.canonicalSlug as slug
      FROM ContentSeries cs
      INNER JOIN ContentVersion cv ON cv.seriesId = cs.id
      WHERE cs.brandId = ?
        AND cs.contentType = 'blog'
        AND cv.status = 'published'
        AND cs.status != 'archived'
    `

    const rows = db.prepare(query).all(brandId) as Array<{ slug: string }>
    db.close()

    return rows.map(r => r.slug)
  } catch (error) {
    console.error('Failed to get blog slugs:', error)
    return []
  }
}
