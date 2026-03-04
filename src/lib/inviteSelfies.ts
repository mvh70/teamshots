import { isRecord } from '@/lib/type-guards'

export interface ParsedInviteSelfie {
  id: string
  key: string
  uploadedAt: string
  used: boolean
  validated?: boolean
  personCount?: number | null
  selfieType?: string | null
  selfieTypeConfidence?: number | null
  isProper?: boolean | null
  improperReason?: string | null
  lightingQuality?: string | null
  backgroundQuality?: string | null
}

function parseFromItems(items: unknown[]): ParsedInviteSelfie[] {
  return items
    .filter(
      (item): item is {
        id: string
        uploadedKey: string
        createdAt?: string
        uploadedAt?: string
        hasGenerations?: boolean
        used?: boolean
        validated?: boolean
        personCount?: number | null
        selfieType?: string | null
        selfieTypeConfidence?: number | null
        isProper?: boolean | null
        improperReason?: string | null
        lightingQuality?: string | null
        backgroundQuality?: string | null
      } =>
        isRecord(item) &&
        typeof item.id === 'string' &&
        typeof item.uploadedKey === 'string'
    )
    .map((item) => ({
      id: item.id,
      key: item.uploadedKey,
      uploadedAt:
        (typeof item.createdAt === 'string' && item.createdAt) ||
        (typeof item.uploadedAt === 'string' && item.uploadedAt) ||
        '',
      used: Boolean(item.hasGenerations ?? item.used),
      validated: typeof item.validated === 'boolean' ? item.validated : undefined,
      personCount: typeof item.personCount === 'number' ? item.personCount : null,
      selfieType: item.selfieType ?? null,
      selfieTypeConfidence:
        typeof item.selfieTypeConfidence === 'number' ? item.selfieTypeConfidence : null,
      isProper: typeof item.isProper === 'boolean' ? item.isProper : null,
      improperReason: typeof item.improperReason === 'string' ? item.improperReason : null,
      lightingQuality: typeof item.lightingQuality === 'string' ? item.lightingQuality : null,
      backgroundQuality:
        typeof item.backgroundQuality === 'string' ? item.backgroundQuality : null,
    }))
}

export function parseInviteSelfiesResponse(data: unknown): ParsedInviteSelfie[] {
  if (!isRecord(data)) return []

  const items = (data as { items?: unknown }).items
  if (Array.isArray(items)) {
    return parseFromItems(items)
  }

  return []
}
