export type SolutionIndustry =
  | 'real-estate'
  | 'medical'
  | 'law-firms'
  | 'financial-services'
  | 'actively-hiring'

export type SolutionConfig = {
  industry: SolutionIndustry
  /** URL slug */
  slug: SolutionIndustry
  /** Display label */
  label: string
  /** Placeholder hero image path (can be replaced later) */
  heroImage: string
}

export const SOLUTIONS: readonly SolutionConfig[] = [
  {
    industry: 'real-estate',
    slug: 'real-estate',
    label: 'Real estate',
    heroImage: '/samples/after-hero.webp',
  },
  {
    industry: 'medical',
    slug: 'medical',
    label: 'Medical',
    heroImage: '/samples/after-hero.webp',
  },
  {
    industry: 'law-firms',
    slug: 'law-firms',
    label: 'Law firms',
    heroImage: '/samples/after-hero.webp',
  },
  {
    industry: 'financial-services',
    slug: 'financial-services',
    label: 'Financial services',
    heroImage: '/samples/after-hero.webp',
  },
  {
    industry: 'actively-hiring',
    slug: 'actively-hiring',
    label: 'Actively hiring companies',
    heroImage: '/samples/after-hero.webp',
  },
]

export function getSolutionBySlug(slug: string): SolutionConfig | null {
  return SOLUTIONS.find((s) => s.slug === slug) ?? null
}

