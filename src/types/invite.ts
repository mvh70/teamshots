export interface InviteData {
  email: string
  teamName: string
  creditsAllocated: number
  expiresAt: string
  hasActiveContext: boolean
  personId?: string
  firstName: string
  lastName?: string
  contextId?: string
  isAdminOnFreePlan?: boolean
  inviterFirstName?: string
}

export interface InviteDashboardStats {
  photosGenerated: number
  creditsRemaining: number
  selfiesUploaded: number
  teamPhotosGenerated: number
  teamName?: string
  adminName?: string | null
  adminEmail?: string | null
  selfiePreviewUrls?: string[]
}
