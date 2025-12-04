/**
 * Package Configuration
 * 
 * Defines active packages, their prices, and metadata.
 * Packages are domain-agnostic - domain configuration in landing-content.ts
 * determines which packages are available on each domain.
 */

export interface PackageMetadata {
  id: string
  name: string
  description: string
  price?: number // Price in USD (undefined means free)
  stripePriceId?: string // Stripe price ID if available for purchase
  /** Target audience hint for UI display */
  audience?: 'team' | 'individual' | 'couple'
}

export const PACKAGES_CONFIG = {
  // Active packages available in the system
  active: {
    // Team-focused packages (teamshotspro.com)
    headshot1: {
      id: 'headshot1',
      name: 'HeadShot1',
      description: 'Professional headshot package with full customization options including background, branding, clothing, style, expression, and lighting controls.',
      price: 0, // Free (included with signup)
      audience: 'team',
    } as PackageMetadata,
    freepackage: {
      id: 'freepackage',
      name: 'Free Package',
      description: 'Free photo style package with background and branding customization options. Perfect for getting started.',
      price: 0, // Free
    } as PackageMetadata,
    tryitforfree: {
      id: 'tryitforfree',
      name: 'Try It For Free',
      description: 'Free test package with TeamShotsPro branding. Perfect for trying the service before upgrading.',
      price: 0, // Free
      audience: 'team',
    } as PackageMetadata,
    
    // Individual-focused packages (photoshotspro.com)
    linkedin: {
      id: 'linkedin',
      name: 'LinkedIn Professional',
      description: 'Optimized for LinkedIn profiles. Clean, professional backgrounds with business-appropriate lighting and styling.',
      price: 0, // Free (included with signup)
      audience: 'individual',
    } as PackageMetadata,
    dating: {
      id: 'dating',
      name: 'Dating Profile',
      description: 'Warm, approachable photos perfect for dating apps. Natural lighting with friendly, authentic expressions.',
      price: 0, // Free (included with signup)
      audience: 'individual',
    } as PackageMetadata,
    casual: {
      id: 'casual',
      name: 'Casual Professional',
      description: 'Relaxed yet professional look. Perfect for creative industries, startups, and social media presence.',
      price: 0, // Free (included with signup)
      audience: 'individual',
    } as PackageMetadata,
    
    // Future: Couple-focused packages (coupleshotspro.com)
    // couple: {
    //   id: 'couple',
    //   name: 'Couple Portrait',
    //   description: 'Beautiful couple photos with coordinated styling and romantic backgrounds.',
    //   price: 0,
    //   audience: 'couple',
    // } as PackageMetadata,
  },
  
  // Default package for paid plans (free plans always use 'freepackage')
  // Note: Domain-specific defaults are in landing-content.ts
  defaultPlanPackage: 'headshot1' as const,
  
  // Package purchase prices (for future purchases)
  prices: {
    headshot1: 0, // Free
    freepackage: 0, // Free
    tryitforfree: 0, // Free
    linkedin: 0, // Free
    dating: 0, // Free
    casual: 0, // Free
  },
} as const

export type PackageId = keyof typeof PACKAGES_CONFIG.active

