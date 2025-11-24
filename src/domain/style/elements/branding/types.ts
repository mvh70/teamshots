export interface BrandingSettings {
  type: 'include' | 'exclude' | 'user-choice'
  logoKey?: string // S3 key for team logo (same as selfies)
  position?: 'background' | 'clothing' | 'elements'
}

