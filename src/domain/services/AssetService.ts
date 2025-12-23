import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { prisma, Prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { s3Client, getS3BucketName, getS3Key } from '@/lib/s3-client'

/**
 * Asset types supported by the system
 */
export type AssetType = 'selfie' | 'logo' | 'background' | 'intermediate' | 'generated' | 'outfit'

/**
 * Owner types for assets
 */
export type AssetOwnerType = 'team' | 'person'

/**
 * Context for permission checks
 */
export interface AssetAccessContext {
  userId?: string
  personId?: string
  teamId?: string
  isAdmin?: boolean
}

/**
 * Parameters for creating a new asset
 */
export interface CreateAssetParams {
  s3Key: string
  type: AssetType
  subType?: string
  mimeType: string
  ownerType: AssetOwnerType
  teamId?: string
  personId?: string
  parentAssetIds?: string[]
  styleFingerprint?: string
  styleContext?: Record<string, unknown>
  width?: number
  height?: number
  sizeBytes?: number
  temporary?: boolean
  expiresAt?: Date
}

const toJsonNullable = (
  value?: Record<string, unknown>
): Prisma.InputJsonValue | Prisma.JsonNullValueInput | undefined => {
  if (value === undefined) return undefined
  return value ? (value as Prisma.InputJsonValue) : Prisma.JsonNull
}

const fromJsonNullable = (
  value: Prisma.JsonValue | typeof Prisma.JsonNull | null
): Record<string, unknown> | null => {
  if (value === null || value === Prisma.JsonNull) return null
  return value as Record<string, unknown>
}

/**
 * Asset Service
 *
 * Centralized management for all file assets (selfies, logos, backgrounds,
 * intermediates, generated outputs). Provides CRUD operations, permission
 * checks, and reuse functionality.
 */
export class AssetService {
  /**
   * Create a new asset record
   */
  static async createAsset(params: CreateAssetParams): Promise<{
    id: string
    s3Key: string
    type: string
    subType: string | null
    mimeType: string
    ownerType: string
    teamId: string | null
    personId: string | null
    parentAssetIds: string[]
    styleFingerprint: string | null
    styleContext: Record<string, unknown> | null
    width: number | null
    height: number | null
    sizeBytes: number | null
    temporary: boolean
    expiresAt: Date | null
    createdAt: Date
    updatedAt: Date
  }> {
    const asset = await prisma.asset.create({
      data: {
        s3Key: params.s3Key,
        type: params.type,
        subType: params.subType,
        mimeType: params.mimeType,
        ownerType: params.ownerType,
        teamId: params.teamId,
        personId: params.personId,
        parentAssetIds: params.parentAssetIds ?? [],
        styleFingerprint: params.styleFingerprint,
        styleContext: toJsonNullable(params.styleContext),
        width: params.width,
        height: params.height,
        sizeBytes: params.sizeBytes,
        temporary: params.temporary ?? false,
        expiresAt: params.expiresAt,
      },
    })

    Logger.debug('Asset created', {
      assetId: asset.id,
      type: asset.type,
      s3Key: asset.s3Key,
    })

    return {
      ...asset,
      styleContext: fromJsonNullable(asset.styleContext),
    }
  }

  /**
   * Get an asset by ID
   */
  static async getAsset(assetId: string): Promise<{
    id: string
    s3Key: string
    type: string
    subType: string | null
    mimeType: string
    ownerType: string
    teamId: string | null
    personId: string | null
    parentAssetIds: string[]
    styleFingerprint: string | null
    styleContext: Record<string, unknown> | null
    width: number | null
    height: number | null
    sizeBytes: number | null
    temporary: boolean
    expiresAt: Date | null
    createdAt: Date
    updatedAt: Date
  } | null> {
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
    })

    if (!asset) {
      return null
    }

    return {
      ...asset,
      styleContext: fromJsonNullable(asset.styleContext),
    }
  }

  /**
   * Get an asset by S3 key
   */
  static async getAssetByKey(s3Key: string): Promise<{
    id: string
    s3Key: string
    type: string
    subType: string | null
    mimeType: string
    ownerType: string
    teamId: string | null
    personId: string | null
    parentAssetIds: string[]
    styleFingerprint: string | null
    styleContext: Record<string, unknown> | null
    width: number | null
    height: number | null
    sizeBytes: number | null
    temporary: boolean
    expiresAt: Date | null
    createdAt: Date
    updatedAt: Date
  } | null> {
    const asset = await prisma.asset.findUnique({
      where: { s3Key },
    })

    if (!asset) {
      return null
    }

    return {
      ...asset,
      styleContext: fromJsonNullable(asset.styleContext),
    }
  }

  /**
   * Resolve an S3 key or Asset ID to an Asset record.
   * If the input is an Asset ID that exists, returns that asset.
   * If the input is an S3 key, checks if an Asset exists for it.
   * If no Asset exists for the S3 key, creates one (lazy migration).
   *
   * This is crucial for ensuring deterministic fingerprinting.
   */
  static async resolveToAsset(
    keyOrId: string,
    ownerInfo: {
      ownerType: AssetOwnerType
      teamId?: string
      personId?: string
      type?: AssetType
      mimeType?: string
    }
  ): Promise<{
    id: string
    s3Key: string
    type: string
    subType: string | null
    mimeType: string
    ownerType: string
    teamId: string | null
    personId: string | null
    parentAssetIds: string[]
    styleFingerprint: string | null
    createdAt: Date
  }> {
    // First, try to find by ID (if it looks like a cuid)
    if (keyOrId.length >= 20 && !keyOrId.includes('/')) {
      const assetById = await prisma.asset.findUnique({
        where: { id: keyOrId },
        select: {
          id: true,
          s3Key: true,
          type: true,
          subType: true,
          mimeType: true,
          ownerType: true,
          teamId: true,
          personId: true,
          parentAssetIds: true,
          styleFingerprint: true,
          createdAt: true,
        },
      })

      if (assetById) {
        return assetById
      }
    }

    // Treat as S3 key - check if asset exists
    const existingAsset = await prisma.asset.findUnique({
      where: { s3Key: keyOrId },
      select: {
        id: true,
        s3Key: true,
        type: true,
        subType: true,
        mimeType: true,
        ownerType: true,
        teamId: true,
        personId: true,
        parentAssetIds: true,
        styleFingerprint: true,
        createdAt: true,
      },
    })

    if (existingAsset) {
      return existingAsset
    }

    // Lazy migration: create asset for existing S3 key
    const type = ownerInfo.type ?? AssetService.inferTypeFromKey(keyOrId)
    const mimeType = ownerInfo.mimeType ?? AssetService.inferMimeTypeFromKey(keyOrId)

    Logger.info('Lazy migration: Creating Asset for existing S3 key', {
      s3Key: keyOrId,
      type,
      ownerType: ownerInfo.ownerType,
    })

    const newAsset = await prisma.asset.create({
      data: {
        s3Key: keyOrId,
        type,
        mimeType,
        ownerType: ownerInfo.ownerType,
        teamId: ownerInfo.teamId,
        personId: ownerInfo.personId,
        parentAssetIds: [],
      },
      select: {
        id: true,
        s3Key: true,
        type: true,
        subType: true,
        mimeType: true,
        ownerType: true,
        teamId: true,
        personId: true,
        parentAssetIds: true,
        styleFingerprint: true,
        createdAt: true,
      },
    })

    return newAsset
  }

  /**
   * Check if a requester can access an asset
   */
  static async canAccess(
    assetId: string,
    context: AssetAccessContext
  ): Promise<boolean> {
    // Admins can access everything
    if (context.isAdmin) {
      return true
    }

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: {
        ownerType: true,
        teamId: true,
        personId: true,
        person: {
          select: {
            teamId: true,
            userId: true,
          },
        },
      },
    })

    if (!asset) {
      return false
    }

    // Person-owned assets: requester must be that person or in same team
    if (asset.ownerType === 'person' && asset.personId) {
      // Direct person match
      if (context.personId === asset.personId) {
        return true
      }

      // Same team check
      if (context.teamId && asset.person?.teamId === context.teamId) {
        return true
      }

      // User owns the person
      if (context.userId && asset.person?.userId === context.userId) {
        return true
      }

      return false
    }

    // Team-owned assets: requester must be team member
    if (asset.ownerType === 'team' && asset.teamId) {
      if (context.teamId === asset.teamId) {
        return true
      }

      // Check if user is member of the team
      if (context.userId) {
        const membership = await prisma.person.findFirst({
          where: {
            userId: context.userId,
            teamId: asset.teamId,
          },
          select: { id: true },
        })

        return !!membership
      }

      return false
    }

    return false
  }

  /**
   * Find a reusable asset by style fingerprint
   */
  static async findReusableAsset(
    fingerprint: string,
    ownerContext?: { teamId?: string; personId?: string }
  ): Promise<{
    id: string
    s3Key: string
    type: string
    subType: string | null
    mimeType: string
    parentAssetIds: string[]
    styleContext: Record<string, unknown> | null
    createdAt: Date
  } | null> {
    const whereClause: {
      styleFingerprint: string
      temporary: boolean
      teamId?: string
      personId?: string
    } = {
      styleFingerprint: fingerprint,
      temporary: false, // Only reuse non-temporary assets
    }

    // Scope to owner if provided
    if (ownerContext?.teamId) {
      whereClause.teamId = ownerContext.teamId
    }
    if (ownerContext?.personId) {
      whereClause.personId = ownerContext.personId
    }

    const asset = await prisma.asset.findFirst({
      where: whereClause,
      orderBy: { createdAt: 'desc' }, // Prefer most recent
      select: {
        id: true,
        s3Key: true,
        type: true,
        subType: true,
        mimeType: true,
        parentAssetIds: true,
        styleContext: true,
        createdAt: true,
      },
    })

    if (!asset) {
      return null
    }

    Logger.debug('Found reusable asset', {
      assetId: asset.id,
      fingerprint,
    })

    return {
      ...asset,
      styleContext: fromJsonNullable(asset.styleContext),
    }
  }

  /**
   * Generate a signed URL for accessing an asset
   */
  static async getSignedUrl(
    assetId: string,
    context: AssetAccessContext,
    expiresIn: number = 300
  ): Promise<string | null> {
    // Check permissions first
    const canAccess = await this.canAccess(assetId, context)
    if (!canAccess) {
      Logger.warn('Asset access denied', { assetId, context })
      return null
    }

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: { s3Key: true },
    })

    if (!asset) {
      return null
    }

    const bucket = getS3BucketName()
    const fullKey = getS3Key(asset.s3Key)
    const command = new GetObjectCommand({ Bucket: bucket, Key: fullKey })
    const url = await getSignedUrl(s3Client, command, { expiresIn })

    return url
  }

  /**
   * Generate a signed URL directly from S3 key (no permission check)
   * Use with caution - only for internal operations
   */
  static async getSignedUrlFromKey(
    s3Key: string,
    expiresIn: number = 300
  ): Promise<string> {
    const bucket = getS3BucketName()
    const fullKey = getS3Key(s3Key)
    const command = new GetObjectCommand({ Bucket: bucket, Key: fullKey })
    const url = await getSignedUrl(s3Client, command, { expiresIn })

    return url
  }

  /**
   * Update asset with fingerprint after generation
   */
  static async updateFingerprint(
    assetId: string,
    fingerprint: string,
    styleContext?: Record<string, unknown>
  ): Promise<void> {
    await prisma.asset.update({
      where: { id: assetId },
      data: {
        styleFingerprint: fingerprint,
        styleContext: toJsonNullable(styleContext),
      },
    })
  }

  /**
   * Link a selfie to an asset
   */
  static async linkSelfieToAsset(
    selfieId: string,
    assetId: string
  ): Promise<void> {
    await prisma.selfie.update({
      where: { id: selfieId },
      data: { assetId },
    })
  }

  /**
   * Link a generation to its output asset
   */
  static async linkGenerationToAsset(
    generationId: string,
    assetId: string
  ): Promise<void> {
    await prisma.generation.update({
      where: { id: generationId },
      data: { outputAssetId: assetId },
    })
  }

  /**
   * Get expired temporary assets for cleanup
   */
  static async getExpiredAssets(limit: number = 100): Promise<
    Array<{
      id: string
      s3Key: string
      type: string
    }>
  > {
    return prisma.asset.findMany({
      where: {
        temporary: true,
        expiresAt: {
          lt: new Date(),
        },
      },
      select: {
        id: true,
        s3Key: true,
        type: true,
      },
      take: limit,
    })
  }

  /**
   * Delete an asset record
   */
  static async deleteAsset(assetId: string): Promise<void> {
    await prisma.asset.delete({
      where: { id: assetId },
    })

    Logger.debug('Asset deleted', { assetId })
  }

  /**
   * Infer asset type from S3 key path
   */
  private static inferTypeFromKey(key: string): AssetType {
    if (key.startsWith('selfies/') || key.includes('/selfie')) {
      return 'selfie'
    }
    if (key.startsWith('logos/') || key.includes('/logo')) {
      return 'logo'
    }
    if (key.startsWith('backgrounds/') || key.includes('/background')) {
      return 'background'
    }
    if (key.startsWith('generations/')) {
      return 'generated'
    }
    if (key.startsWith('intermediates/') || key.includes('/intermediate')) {
      return 'intermediate'
    }
    // Default to generated for unknown paths
    return 'generated'
  }

  /**
   * Infer MIME type from file extension
   */
  private static inferMimeTypeFromKey(key: string): string {
    const lowerKey = key.toLowerCase()
    if (lowerKey.endsWith('.png')) {
      return 'image/png'
    }
    if (lowerKey.endsWith('.jpg') || lowerKey.endsWith('.jpeg')) {
      return 'image/jpeg'
    }
    if (lowerKey.endsWith('.webp')) {
      return 'image/webp'
    }
    if (lowerKey.endsWith('.gif')) {
      return 'image/gif'
    }
    // Default
    return 'image/png'
  }
}
