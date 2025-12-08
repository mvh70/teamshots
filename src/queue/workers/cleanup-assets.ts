/**
 * Asset Cleanup Worker
 *
 * Deletes expired temporary assets from both the database and S3 storage.
 * Designed to be run periodically (e.g., via cron job or queue scheduler).
 *
 * Usage:
 * - As a standalone script: `npx ts-node src/queue/workers/cleanup-assets.ts`
 * - As a module: `await cleanupExpiredAssets()`
 */

import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { createS3Client, getS3BucketName, getS3Key } from '@/lib/s3-client'

const BATCH_SIZE = 100 // Process assets in batches
const MAX_BATCHES = 10 // Safety limit per run

const s3Client = createS3Client({ forcePathStyle: false })
const BUCKET_NAME = getS3BucketName()

export interface CleanupResult {
  assetsDeleted: number
  s3ObjectsDeleted: number
  errors: Array<{ assetId: string; error: string }>
  duration: number
}

/**
 * Delete a single S3 object
 */
async function deleteS3Object(s3Key: string): Promise<boolean> {
  try {
    const fullKey = getS3Key(s3Key)
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fullKey,
      })
    )
    return true
  } catch (error) {
    Logger.warn('Failed to delete S3 object', {
      s3Key,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

/**
 * Clean up expired temporary assets
 *
 * @param dryRun - If true, logs what would be deleted without actually deleting
 * @returns Cleanup statistics
 */
export async function cleanupExpiredAssets(dryRun: boolean = false): Promise<CleanupResult> {
  const startTime = Date.now()
  const result: CleanupResult = {
    assetsDeleted: 0,
    s3ObjectsDeleted: 0,
    errors: [],
    duration: 0,
  }

  Logger.info('Starting asset cleanup', { dryRun })

  let batchCount = 0

  while (batchCount < MAX_BATCHES) {
    // Find expired temporary assets
    const expiredAssets = await prisma.asset.findMany({
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
        subType: true,
      },
      take: BATCH_SIZE,
    })

    if (expiredAssets.length === 0) {
      break // No more expired assets
    }

    batchCount++

    Logger.debug(`Processing batch ${batchCount}`, {
      assetCount: expiredAssets.length,
    })

    for (const asset of expiredAssets) {
      try {
        if (!dryRun) {
          // Delete S3 object first
          const s3Deleted = await deleteS3Object(asset.s3Key)
          if (s3Deleted) {
            result.s3ObjectsDeleted++
          }

          // Delete database record
          // Use deleteMany to avoid errors if asset was already deleted
          const deleteResult = await prisma.asset.deleteMany({
            where: { id: asset.id },
          })

          if (deleteResult.count > 0) {
            result.assetsDeleted++
          }
        } else {
          // Dry run - just count
          result.assetsDeleted++
          result.s3ObjectsDeleted++
        }

        Logger.debug('Deleted expired asset', {
          assetId: asset.id,
          type: asset.type,
          subType: asset.subType,
          dryRun,
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        result.errors.push({
          assetId: asset.id,
          error: errorMessage,
        })
        Logger.error('Failed to delete expired asset', {
          assetId: asset.id,
          error: errorMessage,
        })
      }
    }
  }

  result.duration = Date.now() - startTime

  Logger.info('Asset cleanup completed', {
    ...result,
    errorCount: result.errors.length,
    dryRun,
  })

  return result
}

/**
 * Clean up assets that are orphaned (not linked to any selfie, generation, or cost record)
 * This is a more aggressive cleanup that should be run less frequently.
 */
export async function cleanupOrphanedAssets(
  olderThan: Date = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Default: 7 days old
  dryRun: boolean = false
): Promise<CleanupResult> {
  const startTime = Date.now()
  const result: CleanupResult = {
    assetsDeleted: 0,
    s3ObjectsDeleted: 0,
    errors: [],
    duration: 0,
  }

  Logger.info('Starting orphaned asset cleanup', { olderThan, dryRun })

  // Find assets that:
  // 1. Are not linked to any selfie
  // 2. Are not linked to any generation as output
  // 3. Are not referenced in any GenerationCost record
  // 4. Are older than the specified date
  const orphanedAssets = await prisma.asset.findMany({
    where: {
      createdAt: { lt: olderThan },
      selfie: null,
      generationOutput: null,
      costs: { none: {} },
    },
    select: {
      id: true,
      s3Key: true,
      type: true,
    },
    take: BATCH_SIZE,
  })

  for (const asset of orphanedAssets) {
    try {
      if (!dryRun) {
        const s3Deleted = await deleteS3Object(asset.s3Key)
        if (s3Deleted) {
          result.s3ObjectsDeleted++
        }

        const deleteResult = await prisma.asset.deleteMany({
          where: { id: asset.id },
        })

        if (deleteResult.count > 0) {
          result.assetsDeleted++
        }
      } else {
        result.assetsDeleted++
        result.s3ObjectsDeleted++
      }
    } catch (error) {
      result.errors.push({
        assetId: asset.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  result.duration = Date.now() - startTime

  Logger.info('Orphaned asset cleanup completed', {
    ...result,
    errorCount: result.errors.length,
    dryRun,
  })

  return result
}

// CLI support for running as a standalone script
if (require.main === module) {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')

  cleanupExpiredAssets(dryRun)
    .then((result) => {
      console.log('Cleanup completed:', result)
      process.exit(0)
    })
    .catch((error) => {
      console.error('Cleanup failed:', error)
      process.exit(1)
    })
}
