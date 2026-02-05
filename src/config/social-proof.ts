/**
 * Social proof data for use across marketing pages.
 * Each page can pull relevant testimonials, logos, and metrics.
 *
 * IMPORTANT: Only include REAL, VERIFIED testimonials and customers.
 * Do not fabricate quotes or company names.
 */

export interface Testimonial {
  id: string;
  quote: string;
  quoteEs?: string;
  author: string;
  role: string;
  roleEs?: string;
  company: string;
  companyUrl?: string;
  avatar?: string;
  linkedinUrl?: string; // Required for verification
  rating?: number; // 1-5
  verified: boolean; // Must be true to display
}

/**
 * Featured transformations - real users who agreed to be showcased.
 * These appear in the sample gallery with before/after comparisons.
 */
export interface FeaturedTransformation {
  id: string;
  name: string;
  role: string;
  roleEs?: string;
  company: string;
  companyUrl?: string;
  linkedinUrl: string; // Required - this is the verification
  beforeImage: string;
  afterImage: string;
  isFounder?: boolean; // Flag if this is a TeamShotsPro founder/team member
}

export interface CompanyLogo {
  id: string;
  name: string;
  logo: string; // path to logo image
  industry?: string;
  permission: boolean; // Must have explicit permission to display
}

export interface Metric {
  id: string;
  value: string;
  valueEs?: string;
  label: string;
  labelEs?: string;
  verifiable: boolean; // Can this metric be proven?
  source?: string; // Where does this data come from?
}

export interface SocialProofConfig {
  testimonials: Testimonial[];
  featuredTransformations: FeaturedTransformation[];
  companyLogos: CompanyLogo[];
  metrics: Metric[];
}

/**
 * Central social proof configuration.
 * Only include REAL, VERIFIED data.
 */
export const SOCIAL_PROOF: SocialProofConfig = {
  // Real testimonials from verified customers
  // Add testimonials here as you collect them with explicit permission
  testimonials: [],

  // Featured transformations - these are the real proof
  // Real users with LinkedIn verification who agreed to be showcased
  featuredTransformations: [
    {
      id: 'david-robles',
      name: 'David Robles',
      role: 'Senior Executive',
      roleEs: 'Ejecutivo Senior',
      company: 'Evendo',
      companyUrl: 'https://evendo.com/',
      linkedinUrl: 'https://www.linkedin.com/in/roblesfosg/',
      beforeImage: '/samples/david-before.webp',
      afterImage: '/samples/david-after.webp',
    },
    {
      id: 'clarice-pinto',
      name: 'Clarice Pinto',
      role: 'Founder',
      roleEs: 'Fundadora',
      company: 'Pausetiv',
      companyUrl: 'https://www.pausetiv.com',
      linkedinUrl: 'https://www.linkedin.com/in/clarice-pinto-39578/',
      beforeImage: '/samples/clarice-before.webp',
      afterImage: '/samples/clarice-after.webp',
    },
    {
      id: 'mathieu-van-haperen',
      name: 'Mathieu Van Haperen',
      role: 'Founder',
      roleEs: 'Fundador',
      company: 'TeamShotsPro',
      companyUrl: 'https://teamshotspro.com',
      linkedinUrl: 'https://www.linkedin.com/in/matthieuvanhaperen/',
      beforeImage: '/samples/mathieu-before.webp',
      afterImage: '/samples/mathieu-after.webp',
      isFounder: true, // Transparently marked as founder
    },
  ],

  companyLogos: [],

  // Metrics - only include verifiable claims
  metrics: [
    {
      id: 'generation-time',
      value: '60',
      valueEs: '60',
      label: 'seconds average generation time',
      labelEs: 'segundos tiempo promedio de generación',
      verifiable: true,
      source: 'internal-metrics',
    },
    {
      id: 'photos-per-member',
      value: '10',
      valueEs: '10',
      label: 'professional photos per team member',
      labelEs: 'fotos profesionales por miembro',
      verifiable: true,
      source: 'product-feature',
    },
    {
      id: 'money-back',
      value: '30',
      valueEs: '30',
      label: 'day money-back guarantee',
      labelEs: 'días de garantía de devolución',
      verifiable: true,
      source: 'terms-of-service',
    },
  ],
};

/**
 * Get verified testimonials only
 */
export function getTestimonials(options?: {
  limit?: number;
  minRating?: number;
}): Testimonial[] {
  // Only return verified testimonials
  let results = SOCIAL_PROOF.testimonials.filter(t => t.verified);

  if (options?.minRating) {
    results = results.filter(t => (t.rating || 0) >= options.minRating!);
  }

  if (options?.limit) {
    results = results.slice(0, options.limit);
  }

  return results;
}

/**
 * Get featured transformations (real proof with LinkedIn verification)
 */
export function getFeaturedTransformations(options?: {
  limit?: number;
  excludeFounders?: boolean;
}): FeaturedTransformation[] {
  let results = [...SOCIAL_PROOF.featuredTransformations];

  if (options?.excludeFounders) {
    results = results.filter(t => !t.isFounder);
  }

  if (options?.limit) {
    results = results.slice(0, options.limit);
  }

  return results;
}

/**
 * Get company logos with verified permission
 */
export function getCompanyLogos(options?: {
  limit?: number;
  industry?: string;
}): CompanyLogo[] {
  // Only return logos with explicit permission
  let results = SOCIAL_PROOF.companyLogos.filter(c => c.permission);

  if (options?.industry) {
    results = results.filter(c => c.industry === options.industry);
  }

  if (options?.limit) {
    results = results.slice(0, options.limit);
  }

  return results;
}

/**
 * Get verifiable metrics only
 */
export function getVerifiableMetrics(): Metric[] {
  return SOCIAL_PROOF.metrics.filter(m => m.verifiable);
}

/**
 * Get a specific metric by ID
 */
export function getMetric(id: string): Metric | undefined {
  return SOCIAL_PROOF.metrics.find(m => m.id === id);
}

/**
 * Check if we have sufficient honest social proof to display
 * Prioritizes featured transformations over testimonials
 */
export function hasSufficientSocialProof(): boolean {
  const verifiedTestimonials = SOCIAL_PROOF.testimonials.filter(t => t.verified);
  const featuredTransformations = SOCIAL_PROOF.featuredTransformations;
  const permittedLogos = SOCIAL_PROOF.companyLogos.filter(c => c.permission);

  return (
    verifiedTestimonials.length >= 1 ||
    featuredTransformations.length >= 2 ||
    permittedLogos.length >= 3
  );
}

/**
 * Get the recommended social proof approach based on available data
 */
export function getRecommendedSocialProofType(): 'testimonials' | 'transformations' | 'metrics' | 'none' {
  const verifiedTestimonials = SOCIAL_PROOF.testimonials.filter(t => t.verified);

  if (verifiedTestimonials.length >= 3) {
    return 'testimonials';
  }

  if (SOCIAL_PROOF.featuredTransformations.length >= 2) {
    return 'transformations';
  }

  if (SOCIAL_PROOF.metrics.filter(m => m.verifiable).length >= 2) {
    return 'metrics';
  }

  return 'none';
}
