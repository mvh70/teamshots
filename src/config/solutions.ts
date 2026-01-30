/**
 * AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
 *
 * This file is generated from teamshots-marketing/config/brands/teamshotspro/content-silo.json
 * Run: npx tsx src/generators/sync-solutions.ts (from teamshots-marketing directory)
 *
 * Last generated: 2026-01-14T10:50:39.856Z
 */

export type SolutionIndustry =
  | 'real-estate'
  | 'medical'
  | 'law-firms'
  | 'financial-services'
  | 'actively-hiring'
  | 'consulting'
  | 'accounting'

export interface SolutionConfig {
  industry: SolutionIndustry
  /** URL slug */
  slug: SolutionIndustry
  /** Display label */
  label: string
  /** Hero "after" image path */
  heroImage: string
  /** Hero "before" image path */
  beforeImage: string
  /** Before/after showcase images */
  showcaseImages: string[]
  /** Industry company logos for trust bar */
  industryLogos: string[]
  /** Platforms where headshots are used */
  platforms: string[]
  /** Comparison data vs traditional photography */
  comparisonData: {
    traditionalCost: string
    traditionalTime: string
  }
  /** Optional color accent for industry */
  colorAccent?: string
}

export const SOLUTIONS: readonly SolutionConfig[] = [
  {
    industry: 'real-estate',
    slug: 'real-estate',
    label: 'Real estate',
    heroImage: '/api/cms/images/solutions/real-estate-after.webp',
    beforeImage: '/api/cms/images/solutions/real-estate-before.webp',
    showcaseImages: [
      '/samples/after-hero.webp',
      '/samples/after-hero.webp',
      '/samples/after-hero.webp',
    ],
    industryLogos: [],
    platforms: ["MLS Listings","Zillow","Realtor.com","For Sale Signs","Business Cards","Team Website"],
    comparisonData: {
      traditionalCost: '$250-500',
      traditionalTime: '2-3 weeks',
    },
  },
  {
    industry: 'medical',
    slug: 'medical',
    label: 'Medical',
    heroImage: '/api/cms/images/solutions/medical-after.webp',
    beforeImage: '/api/cms/images/solutions/medical-before.webp',
    showcaseImages: [
      '/samples/after-hero.webp',
      '/samples/after-hero.webp',
      '/samples/after-hero.webp',
    ],
    industryLogos: [],
    platforms: ["Hospital Directory","ID Badges","Patient Portal","LinkedIn","Practice Website","Insurance Panels"],
    comparisonData: {
      traditionalCost: '$200-400',
      traditionalTime: '2-4 weeks',
    },
  },
  {
    industry: 'law-firms',
    slug: 'law-firms',
    label: 'Law firms',
    heroImage: '/api/cms/images/solutions/law-firms-after.webp',
    beforeImage: '/api/cms/images/solutions/law-firms-before.webp',
    showcaseImages: [
      '/samples/after-hero.webp',
      '/samples/after-hero.webp',
      '/samples/after-hero.webp',
    ],
    industryLogos: [],
    platforms: ["Firm Website","LinkedIn","Martindale-Hubbell","Avvo","Business Cards","Legal Directories"],
    comparisonData: {
      traditionalCost: '$300-600',
      traditionalTime: '2-3 weeks',
    },
  },
  {
    industry: 'financial-services',
    slug: 'financial-services',
    label: 'Financial services',
    heroImage: '/api/cms/images/solutions/financial-services-after.webp',
    beforeImage: '/api/cms/images/solutions/financial-services-before.webp',
    showcaseImages: [
      '/samples/after-hero.webp',
      '/samples/after-hero.webp',
      '/samples/after-hero.webp',
    ],
    industryLogos: [],
    platforms: ["Company Website","LinkedIn","Client Portals","Business Cards","Annual Reports","Email Signatures"],
    comparisonData: {
      traditionalCost: '$300-500',
      traditionalTime: '2-3 weeks',
    },
  },
  {
    industry: 'actively-hiring',
    slug: 'actively-hiring',
    label: 'Actively hiring companies',
    heroImage: '/api/cms/images/solutions/actively-hiring-after.webp',
    beforeImage: '/api/cms/images/solutions/actively-hiring-before.webp',
    showcaseImages: [
      '/samples/after-hero.webp',
      '/samples/after-hero.webp',
      '/samples/after-hero.webp',
    ],
    industryLogos: [],
    platforms: ["Careers Page","LinkedIn","Job Postings","Team Page","Glassdoor","Company Blog"],
    comparisonData: {
      traditionalCost: '$200-400',
      traditionalTime: '2-4 weeks',
    },
  },
  {
    industry: 'consulting',
    slug: 'consulting',
    label: 'Consulting firms',
    heroImage: '/api/cms/images/solutions/consulting-after.webp',
    beforeImage: '/api/cms/images/solutions/consulting-before.webp',
    showcaseImages: [
      '/samples/after-hero.webp',
      '/samples/after-hero.webp',
      '/samples/after-hero.webp',
    ],
    industryLogos: [],
    platforms: ["Company Website","LinkedIn","Proposals","Business Cards","Case Studies","Speaking Bios"],
    comparisonData: {
      traditionalCost: '$300-500',
      traditionalTime: '2-3 weeks',
    },
  },
  {
    industry: 'accounting',
    slug: 'accounting',
    label: 'Accounting firms',
    heroImage: '/api/cms/images/solutions/accounting-after.webp',
    beforeImage: '/api/cms/images/solutions/accounting-before.webp',
    showcaseImages: [
      '/samples/after-hero.webp',
      '/samples/after-hero.webp',
      '/samples/after-hero.webp',
    ],
    industryLogos: [],
    platforms: ["Firm Website","LinkedIn","CPA Directories","Business Cards","Client Newsletters","Tax Season Materials"],
    comparisonData: {
      traditionalCost: '$250-400',
      traditionalTime: '2-3 weeks',
    },
  },
]

export function getSolutionBySlug(slug: string): SolutionConfig | null {
  return SOLUTIONS.find((s) => s.slug === slug) ?? null
}
