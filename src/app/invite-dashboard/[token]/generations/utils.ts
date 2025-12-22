import type { GenerationListItem } from '@/app/[locale]/app/generations/components/GenerationCard'

/**
 * Extract the key parameter from a file URL
 * URLs are in format: /api/files/get?key=XXX&token=YYY
 */
export function extractKeyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url, window.location.origin)
    return urlObj.searchParams.get('key')
  } catch {
    // If URL parsing fails, try regex fallback
    const match = url.match(/[?&]key=([^&]+)/)
    return match ? decodeURIComponent(match[1]) : null
  }
}

/**
 * Transform invited API generation response to GenerationListItem format
 */
export function transformInvitedGeneration(
  generation: {
    id: string
    selfieKey: string
    selfieUrl: string
    inputSelfieUrls?: string[]
    generatedPhotos: Array<{
      id: string
      url: string
      style: string
    }>
    status: 'pending' | 'processing' | 'completed' | 'failed'
    createdAt: string
    generationType: 'personal' | 'team'
    creditsUsed: number
    maxRegenerations: number
    remainingRegenerations: number
    isOriginal: boolean
    jobStatus?: {
      id: string
      progress: number
      message?: string
      attemptsMade: number
      processedOn?: number
      finishedOn?: number
      failedReason?: string
    }
  }
): GenerationListItem {
  // Extract keys from URLs
  const selfieKey = extractKeyFromUrl(generation.selfieUrl) || generation.selfieKey
  const generatedKey = generation.generatedPhotos.length > 0
    ? extractKeyFromUrl(generation.generatedPhotos[0].url)
    : null

  // Use first input selfie URL's key if available, otherwise use main selfie key
  const uploadedKey = generation.inputSelfieUrls && generation.inputSelfieUrls.length > 0
    ? (extractKeyFromUrl(generation.inputSelfieUrls[0]) || selfieKey)
    : selfieKey

  return {
    id: generation.id,
    uploadedKey: uploadedKey || '',
    generatedKey: generatedKey || undefined,
    status: generation.status,
    createdAt: generation.createdAt,
    contextName: generation.generatedPhotos.length > 0 ? generation.generatedPhotos[0].style : 'Freestyle',
    costCredits: generation.creditsUsed,
    maxRegenerations: generation.maxRegenerations,
    remainingRegenerations: generation.remainingRegenerations,
    generationType: generation.generationType,
    isOriginal: generation.isOriginal,
    isOwnGeneration: true, // Invited users always own their generations
    jobStatus: generation.jobStatus,
    inputSelfieUrls: generation.inputSelfieUrls, // Preserve for potential future use
  }
}

