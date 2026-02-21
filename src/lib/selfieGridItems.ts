interface SelfieGridClassificationFields {
  selfieType?: string | null
  selfieTypeConfidence?: number | null
  isProper?: boolean | null
  improperReason?: string | null
  lightingQuality?: string | null
  backgroundQuality?: string | null
}

export interface SelfieListItem extends SelfieGridClassificationFields {
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

export function mapSelfieListItemsToGridItems(
  items: SelfieListItem[],
  options?: { token?: string }
): SelfieGridItem[] {
  const tokenSuffix = options?.token ? `&token=${encodeURIComponent(options.token)}` : ''

  return items.map((item) => ({
    id: item.id,
    key: item.uploadedKey,
    url: `/api/files/get?key=${encodeURIComponent(item.uploadedKey)}${tokenSuffix}`,
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

export function mapSessionSelfiesToGridItems(items: SelfieListItem[]): SelfieGridItem[] {
  return mapSelfieListItemsToGridItems(items)
}

export function mapInviteSelfiesToGridItems(items: InviteSelfieListItem[] | SelfieListItem[], token?: string): SelfieGridItem[] {
  if (items.length === 0) {
    return []
  }

  if ('uploadedKey' in items[0]) {
    return mapSelfieListItemsToGridItems(items as SelfieListItem[], token ? { token } : undefined)
  }

  return (items as InviteSelfieListItem[]).map((item) => ({
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
