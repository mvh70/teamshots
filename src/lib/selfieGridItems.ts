interface SelfieGridClassificationFields {
  selfieType?: string | null
  selfieTypeConfidence?: number | null
  isProper?: boolean | null
  improperReason?: string | null
  lightingQuality?: string | null
  backgroundQuality?: string | null
}

interface SessionSelfieListItem extends SelfieGridClassificationFields {
  id: string
  uploadedKey: string
  createdAt: string
  hasGenerations: boolean
}

interface InviteSelfieListItem extends SelfieGridClassificationFields {
  id: string
  key: string
  url: string
  uploadedAt: string
  used?: boolean
}

export interface SelfieGridItem {
  id: string
  key: string
  url: string
  uploadedAt: string
  used?: boolean
  selfieType?: string | null
  selfieTypeConfidence?: number | null
  isProper?: boolean
  improperReason?: string | null
  lightingQuality?: string | null
  backgroundQuality?: string | null
}

export function mapSessionSelfiesToGridItems(items: SessionSelfieListItem[]): SelfieGridItem[] {
  return items.map((item) => ({
    id: item.id,
    key: item.uploadedKey,
    url: `/api/files/get?key=${encodeURIComponent(item.uploadedKey)}`,
    uploadedAt: item.createdAt,
    used: item.hasGenerations,
    selfieType: item.selfieType,
    selfieTypeConfidence: item.selfieTypeConfidence,
    isProper: item.isProper ?? undefined,
    improperReason: item.improperReason,
    lightingQuality: item.lightingQuality,
    backgroundQuality: item.backgroundQuality,
  }))
}

export function mapInviteSelfiesToGridItems(items: InviteSelfieListItem[]): SelfieGridItem[] {
  return items.map((item) => ({
    id: item.id,
    key: item.key,
    url: item.url,
    uploadedAt: item.uploadedAt,
    used: item.used,
    selfieType: item.selfieType,
    selfieTypeConfidence: item.selfieTypeConfidence,
    isProper: item.isProper ?? undefined,
    improperReason: item.improperReason,
    lightingQuality: item.lightingQuality,
    backgroundQuality: item.backgroundQuality,
  }))
}
