import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { auth } from '@/auth'
import { Logger } from '@/lib/logger'
import { SecurityLogger } from '@/lib/security-logger'
import { createS3Client, getS3BucketName, getS3Key } from '@/lib/s3-client'
import { RATE_LIMITS } from '@/config/rate-limit-config'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rate-limit'
import { getUserEffectiveRoles, getUserWithRoles } from '@/domain/access/roles'
import { getUserSubscription } from '@/domain/subscription/subscription'
import { findFileOwnership, validateInviteToken, isFileAuthorized } from '@/lib/file-ownership'
import { validateMobileHandoffToken } from '@/lib/mobile-handoff'
import { prisma } from '@/lib/prisma'


export const runtime = 'nodejs'
const s3 = createS3Client()
const bucket = getS3BucketName()

function fileNotFoundResponse() {
  return NextResponse.json(
    { error: 'File not found' },
    {
      status: 404,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    }
  )
}

// SECURITY: Allowed file extensions to prevent arbitrary file access
const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', // Images
  '.mp4', '.mov', '.avi', // Videos (if supported)
  '.pdf', // Documents (if supported)
])

// SECURITY: Allowed path prefixes to prevent path traversal
const ALLOWED_PREFIXES = [
  'selfies/',
  'backgrounds/',
  'logos/',
  'generations/',
  'contexts/',
  'outfits/',
  'temp/',
]

/**
 * SECURITY: Validate S3 key to prevent path traversal attacks
 * Checks for:
 * - Path traversal sequences (../, ..\, ..%2F, etc)
 * - Null bytes
 * - Absolute paths
 * - Whitelisted path prefixes
 * - Whitelisted file extensions
 */
function validateS3Key(key: string): { valid: boolean; reason?: string } {
  // Check for path traversal sequences
  const pathTraversalPatterns = [
    '../',
    '..\\',
    '..%2F',
    '..%5C',
    '%2e%2e/',
    '%2e%2e\\',
    '..%252F',
    '..%255C',
  ]

  const lowerKey = key.toLowerCase()
  for (const pattern of pathTraversalPatterns) {
    if (lowerKey.includes(pattern)) {
      return { valid: false, reason: 'Path traversal attempt detected' }
    }
  }

  // Check for null bytes
  if (key.includes('\0') || key.includes('%00')) {
    return { valid: false, reason: 'Null byte detected' }
  }

  // Check for absolute paths
  if (key.startsWith('/') || key.startsWith('\\') || /^[a-zA-Z]:/.test(key)) {
    return { valid: false, reason: 'Absolute path not allowed' }
  }

  // Normalize path and check it doesn't escape bounds
  const normalizedPath = key.replace(/\\/g, '/').replace(/\/+/g, '/')
  if (normalizedPath !== key) {
    return { valid: false, reason: 'Path normalization mismatch' }
  }

  // Check path segments don't contain only dots
  const segments = normalizedPath.split('/')
  for (const segment of segments) {
    if (/^\.+$/.test(segment)) {
      return { valid: false, reason: 'Invalid path segment' }
    }
  }

  // Whitelist: must start with allowed prefix
  const hasAllowedPrefix = ALLOWED_PREFIXES.some(prefix => normalizedPath.startsWith(prefix))
  if (!hasAllowedPrefix) {
    return { valid: false, reason: 'Path not in allowed directories' }
  }

  // Whitelist: must have allowed extension
  const hasAllowedExtension = ALLOWED_EXTENSIONS.has(
    normalizedPath.substring(normalizedPath.lastIndexOf('.')).toLowerCase()
  )
  if (!hasAllowedExtension) {
    return { valid: false, reason: 'File extension not allowed' }
  }

  return { valid: true }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')
  if (!key) {
    return NextResponse.json({ error: 'Missing key' }, { status: 400 })
  }

  // SECURITY: Validate key to prevent path traversal attacks
  const validation = validateS3Key(key)
  if (!validation.valid) {
    Logger.warn('[files/get] Invalid S3 key rejected', {
      key,
      reason: validation.reason,
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    })
    await SecurityLogger.logSuspiciousActivity(
      'anonymous',
      'path_traversal_attempt',
      {
        key,
        reason: validation.reason,
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
      }
    )
    return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
  }

  try {
    const session = await auth()
    const token = searchParams.get('token')
    const handoffToken = searchParams.get('handoffToken')

    if (!session?.user?.id && !token && !handoffToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rateConfig = RATE_LIMITS.filesGet ?? RATE_LIMITS.api
    let rateIdentifier: string

    if (session?.user?.id) {
      rateIdentifier = `files-get:user:${session.user.id}`
    } else if (token) {
      rateIdentifier = `files-get:token:${token}`
    } else if (handoffToken) {
      rateIdentifier = `files-get:handoff:${handoffToken}`
    } else {
      rateIdentifier = await getRateLimitIdentifier(req, 'files-get')
    }

    const rateResult = await checkRateLimit(rateIdentifier, rateConfig.limit, rateConfig.window)
    if (!rateResult.success) {
      await SecurityLogger.logRateLimitExceeded(rateIdentifier)
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateResult.reset - Date.now()) / 1000).toString(),
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        }
      )
    }

    let invitePersonId: string | null = null
    let inviteTeamId: string | null = null
    let inviteContextId: string | null = null
    let handoffPersonId: string | null = null
    
    if (!session?.user?.id && token) {
      const inviteData = await validateInviteToken(token)
      if (!inviteData) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
      }
      invitePersonId = inviteData.personId
      inviteTeamId = inviteData.teamId
      inviteContextId = inviteData.contextId
    }
    
    // Validate handoff token for mobile selfie upload flow
    if (!session?.user?.id && !token && handoffToken) {
      const handoffResult = await validateMobileHandoffToken(handoffToken)
      if (!handoffResult.success) {
        return NextResponse.json({ error: 'Invalid handoff token' }, { status: 401 })
      }
      handoffPersonId = handoffResult.context.personId
    }

    let userWithRoles = null
    let roles = null
    if (session?.user?.id) {
      // OPTIMIZATION: Fetch subscription in parallel with user to avoid duplicate queries
      const [user, subscription] = await Promise.all([
        getUserWithRoles(session.user.id),
        getUserSubscription(session.user.id)
      ])
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userWithRoles = user
      // Pass subscription to avoid duplicate query
      roles = await getUserEffectiveRoles(user, subscription)
    }

    const ownership = await findFileOwnership(key)

    // Special case: Allow access to background/logo/outfit files users uploaded
    // even if not yet saved to a context (e.g., during style customization)
    // Also allow selfie access via handoff token
    let allowAccessWithoutOwnership = false
    const effectivePersonId = invitePersonId || handoffPersonId
    
    // Special case: Allow access to files from freepackage context for all logged-in users
    // Freepackage is a shared context that all free plan users should be able to access
    let isFreepackageContext = false
    if (ownership?.type === 'context' && ownership.contextId && session?.user?.id) {
      const freePackageStyleSetting = await prisma.appSetting.findUnique({
        where: { key: 'freePackageStyleId' }
      })
      if (freePackageStyleSetting?.value === ownership.contextId) {
        isFreepackageContext = true
      }
    }
    
    if (!ownership) {
      if (effectivePersonId && (key.startsWith(`backgrounds/${effectivePersonId}/`) || key.startsWith(`logos/${effectivePersonId}/`) || key.startsWith(`outfits/${effectivePersonId}/`))) {
        allowAccessWithoutOwnership = true
      } else if (effectivePersonId && key.startsWith(`selfies/${effectivePersonId}`)) {
        // Allow selfie access via handoff or invite token for the associated person
        allowAccessWithoutOwnership = true
      } else if (userWithRoles?.person?.id && (key.startsWith(`backgrounds/${userWithRoles.person.id}/`) || key.startsWith(`logos/${userWithRoles.person.id}/`) || key.startsWith(`outfits/${userWithRoles.person.id}/`))) {
        allowAccessWithoutOwnership = true
      } else {
        return fileNotFoundResponse()
      }
    }

    // Allow access if it's the freepackage context, otherwise check normal authorization
    const authorized = isFreepackageContext || (ownership ? isFileAuthorized(ownership, userWithRoles, roles, invitePersonId, inviteTeamId, inviteContextId, key, handoffPersonId) : allowAccessWithoutOwnership)

    if (!authorized) {
      if (session?.user?.id) {
        await SecurityLogger.logPermissionDenied(session.user.id, 'files.get', key)
      }
      return fileNotFoundResponse()
    }

    const s3Key = getS3Key(key)
    const command = new GetObjectCommand({ Bucket: bucket, Key: s3Key })
    const response = await s3.send(command)

    if (!response.Body) {
      Logger.error('[files/get] empty body', { key })
      return fileNotFoundResponse()
    }

    const chunks: Uint8Array[] = []
    // @ts-expect-error - Body is iterable in AWS SDK v3
    for await (const chunk of response.Body) {
      chunks.push(chunk)
    }
    const buffer = Buffer.concat(chunks)

    const headers: Record<string, string> = {
      'Content-Type': response.ContentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'CDN-Cache-Control': 'public, max-age=31536000, immutable',
    }

    if (typeof response.ContentLength === 'number') {
      headers['Content-Length'] = response.ContentLength.toString()
    }

    if (response.ETag) {
      headers['ETag'] = response.ETag
    }

    if (response.LastModified) {
      headers['Last-Modified'] = response.LastModified.toUTCString()
    }

    return new NextResponse(buffer, {
      headers,
    })
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    Logger.error('[files/get] error', { error, key })

    if (error.includes('NotFound') || error.includes('NoSuchKey') || error.includes('404')) {
      return fileNotFoundResponse()
    }

    return NextResponse.json(
      { error: 'Failed to get file' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    )
  }
}

