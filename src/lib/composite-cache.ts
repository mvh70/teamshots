/**
 * Local Composite Cache
 *
 * Stores composite images locally for workflow retry support.
 * Much faster than S3 uploads, with automatic cleanup of old files.
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { Logger } from '@/lib/logger'

/** Cache directory for composite images */
const CACHE_DIR = path.join(process.cwd(), 'tmp', 'composite-cache')

/** Maximum age for cached files (10 minutes in ms) */
const MAX_AGE_MS = 10 * 60 * 1000

/** Composite types that can be cached */
export type CompositeType = 'face' | 'body' | 'selfie' | 'garment'

/**
 * Cached composite metadata
 */
export interface CachedComposite {
  /** Local file path */
  path: string
  /** MIME type */
  mimeType: string
  /** Description for reference */
  description?: string
}

/**
 * Generate cache key for a composite
 */
function getCacheKey(generationId: string, type: CompositeType): string {
  return `${generationId}-${type}.png`
}

/**
 * Get full path for a cached composite
 */
function getCachePath(generationId: string, type: CompositeType): string {
  return path.join(CACHE_DIR, getCacheKey(generationId, type))
}

/**
 * Ensure cache directory exists
 */
async function ensureCacheDir(): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true })
}

/**
 * Clean up cached files older than MAX_AGE_MS
 * Called lazily on cache operations
 */
async function cleanupOldFiles(): Promise<void> {
  try {
    await ensureCacheDir()
    const files = await fs.readdir(CACHE_DIR)
    const now = Date.now()
    let cleanedCount = 0

    for (const file of files) {
      const filePath = path.join(CACHE_DIR, file)
      try {
        const stats = await fs.stat(filePath)
        const age = now - stats.mtimeMs

        if (age > MAX_AGE_MS) {
          await fs.unlink(filePath)
          cleanedCount++
        }
      } catch {
        // File may have been deleted by another process, ignore
      }
    }

    if (cleanedCount > 0) {
      Logger.debug('[CompositeCache] Cleaned up old files', { cleanedCount })
    }
  } catch (error) {
    // Non-critical, log and continue
    Logger.warn('[CompositeCache] Cleanup failed', {
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * Save a composite to local cache
 *
 * @param buffer - Image buffer to cache
 * @param generationId - Generation ID
 * @param type - Type of composite
 * @param metadata - Optional metadata
 * @returns Cached composite info
 */
export async function cacheComposite(
  buffer: Buffer,
  generationId: string,
  type: CompositeType,
  metadata?: { description?: string; mimeType?: string }
): Promise<CachedComposite> {
  // Cleanup old files lazily (non-blocking)
  cleanupOldFiles().catch(() => {})

  await ensureCacheDir()

  const cachePath = getCachePath(generationId, type)
  await fs.writeFile(cachePath, buffer)

  Logger.debug('[CompositeCache] Cached composite', {
    generationId,
    type,
    path: cachePath,
    sizeKB: Math.round(buffer.length / 1024)
  })

  return {
    path: cachePath,
    mimeType: metadata?.mimeType ?? 'image/png',
    description: metadata?.description
  }
}

/**
 * Load a composite from local cache
 *
 * @param generationId - Generation ID
 * @param type - Type of composite
 * @returns Buffer and metadata, or null if not found
 */
export async function loadCachedComposite(
  generationId: string,
  type: CompositeType
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const cachePath = getCachePath(generationId, type)

  try {
    const buffer = await fs.readFile(cachePath)

    Logger.debug('[CompositeCache] Loaded cached composite', {
      generationId,
      type,
      sizeKB: Math.round(buffer.length / 1024)
    })

    return {
      buffer,
      mimeType: 'image/png'
    }
  } catch {
    // File doesn't exist or unreadable
    return null
  }
}

/**
 * Check if a composite is cached
 */
export async function isCompositeCached(
  generationId: string,
  type: CompositeType
): Promise<boolean> {
  const cachePath = getCachePath(generationId, type)

  try {
    await fs.access(cachePath)
    return true
  } catch {
    return false
  }
}

/**
 * Delete a cached composite
 */
export async function deleteCachedComposite(
  generationId: string,
  type: CompositeType
): Promise<void> {
  const cachePath = getCachePath(generationId, type)

  try {
    await fs.unlink(cachePath)
    Logger.debug('[CompositeCache] Deleted cached composite', {
      generationId,
      type
    })
  } catch {
    // File may not exist, ignore
  }
}

/**
 * Delete all cached composites for a generation
 */
export async function deleteAllCachedComposites(generationId: string): Promise<void> {
  const types: CompositeType[] = ['face', 'body', 'selfie', 'garment']

  await Promise.all(types.map((type) => deleteCachedComposite(generationId, type)))
}

/**
 * Convert cached composite to base64 reference format
 * Compatible with existing ReferenceImage interface
 */
export async function cachedCompositeToReference(
  generationId: string,
  type: CompositeType,
  description?: string
): Promise<{ base64: string; mimeType: string; description?: string } | null> {
  const cached = await loadCachedComposite(generationId, type)

  if (!cached) return null

  return {
    base64: cached.buffer.toString('base64'),
    mimeType: cached.mimeType,
    description
  }
}
