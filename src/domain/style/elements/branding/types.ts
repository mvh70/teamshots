export interface BrandingSettings {
  type: 'include' | 'exclude' | 'user-choice'
  logoKey?: string // Legacy: S3 key for team logo - prefer logoAssetId
  logoAssetId?: string // Preferred: Asset ID for team logo
  position?: 'background' | 'clothing' | 'elements'
}

