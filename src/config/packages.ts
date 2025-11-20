/**
 * Package Configuration
 * 
 * Defines active packages, their prices, and metadata
 */

export interface PackageMetadata {
  id: string
  name: string
  description: string
  price?: number // Price in USD (undefined means free)
  stripePriceId?: string // Stripe price ID if available for purchase
}

export const PACKAGES_CONFIG = {
  // Active packages available in the system
  active: {
    headshot1: {
      id: 'headshot1',
      name: 'HeadShot1',
      description: 'Professional headshot package with full customization options including background, branding, clothing, style, expression, and lighting controls.',
      price: 0, // Free (included with signup)
    } as PackageMetadata,
    freepackage: {
      id: 'freepackage',
      name: 'Free Package',
      description: 'Free photo style package with background and branding customization options. Perfect for getting started.',
      price: 0, // Free
    } as PackageMetadata,
  },
  
  // Default package for paid plans (free plans always use 'freepackage')
  defaultPlanPackage: 'headshot1' as const,
  
  // Package purchase prices (for future purchases)
  prices: {
    headshot1: 0, // Free
    freepackage: 0, // Free
  },
} as const

export type PackageId = keyof typeof PACKAGES_CONFIG.active

