/**
 * Signed URL Generation API Endpoint
 *
 * SECURITY: Generates time-limited signed URLs for authorized S3 access
 * This allows direct client access to S3 without proxying through the server
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { Logger } from '@/lib/logger'
import { SecurityLogger } from '@/lib/security-logger'
import { generateSignedUrl, generateSignedUrls, isValidS3Key } from '@/lib/s3-signed-url'
import { findFileOwnership, validateInviteToken, isFileAuthorized } from '@/lib/file-ownership'
import { validateMobileHandoffToken } from '@/lib/mobile-handoff'
import { getUserEffectiveRoles, getUserWithRoles } from '@/domain/access/roles'
import { getUserSubscription } from '@/domain/subscription/subscription'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rate-limit'
import { RATE_LIMITS } from '@/config/rate-limit-config'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const body = await req.json()
    const { keys, key, expiresIn } = body

    // Validate input: either 'key' (string) or 'keys' (array)
    if (!key && !keys) {
      return NextResponse.json({ error: 'Missing key or keys parameter' }, { status: 400 })
    }

    if (key && keys) {
      return NextResponse.json({ error: 'Provide either key or keys, not both' }, { status: 400 })
    }

    const requestedKeys: string[] = key ? [key] : keys
    if (!Array.isArray(requestedKeys) || requestedKeys.length === 0) {
      return NextResponse.json({ error: 'Invalid keys format' }, { status: 400 })
    }

    // Limit to 50 keys per request
    if (requestedKeys.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 keys per request' }, { status: 400 })
    }

    // Validate all keys
    for (const k of requestedKeys) {
      if (!isValidS3Key(k)) {
        Logger.warn('[signed-url] Invalid S3 key rejected', { key: k })
        await SecurityLogger.logSuspiciousActivity(
          'anonymous',
          'invalid_s3_key_signed_url_request',
          {
            key: k,
            ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
          }
        )
        return NextResponse.json({ error: 'Invalid S3 key format' }, { status: 400 })
      }
    }

    // Get session or token
    const session = await auth()
    const token = req.nextUrl.searchParams.get('token')
    const handoffToken = req.nextUrl.searchParams.get('handoffToken')

    if (!session?.user?.id && !token && !handoffToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting
    const rateConfig = RATE_LIMITS.filesGet ?? RATE_LIMITS.api
    let rateIdentifier: string

    if (session?.user?.id) {
      rateIdentifier = `signed-url:user:${session.user.id}`
    } else if (token) {
      rateIdentifier = `signed-url:token:${token}`
    } else if (handoffToken) {
      rateIdentifier = `signed-url:handoff:${handoffToken}`
    } else {
      rateIdentifier = await getRateLimitIdentifier(req, 'signed-url')
    }

    const rateResult = await checkRateLimit(rateIdentifier, rateConfig.limit, rateConfig.window)
    if (!rateResult.success) {
      await SecurityLogger.logRateLimitExceeded(rateIdentifier)
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateResult.reset - Date.now()) / 1000).toString()
          }
        }
      )
    }

    // Validate tokens
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

    if (!session?.user?.id && !token && handoffToken) {
      const handoffResult = await validateMobileHandoffToken(handoffToken)
      if (!handoffResult.success) {
        return NextResponse.json({ error: 'Invalid handoff token' }, { status: 401 })
      }
      handoffPersonId = handoffResult.context.personId
    }

    // Get user roles if authenticated
    let userWithRoles = null
    let roles = null
    if (session?.user?.id) {
      const [user, subscription] = await Promise.all([
        getUserWithRoles(session.user.id),
        getUserSubscription(session.user.id)
      ])
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userWithRoles = user
      roles = await getUserEffectiveRoles(user, subscription)
    }

    // Authorize each key
    const authorizedKeys: string[] = []
    for (const k of requestedKeys) {
      const ownership = await findFileOwnership(k)

      // Special case: Allow access to background/logo files users uploaded
      let allowAccessWithoutOwnership = false
      const effectivePersonId = invitePersonId || handoffPersonId

      if (!ownership) {
        if (effectivePersonId && (k.startsWith(`backgrounds/${effectivePersonId}/`) || k.startsWith(`logos/${effectivePersonId}/`))) {
          allowAccessWithoutOwnership = true
        } else if (effectivePersonId && k.startsWith(`selfies/${effectivePersonId}`)) {
          allowAccessWithoutOwnership = true
        } else if (userWithRoles?.person?.id && (k.startsWith(`backgrounds/${userWithRoles.person.id}/`) || k.startsWith(`logos/${userWithRoles.person.id}/`))) {
          allowAccessWithoutOwnership = true
        }
      }

      const authorized = ownership
        ? isFileAuthorized(ownership, userWithRoles, roles, invitePersonId, inviteTeamId, inviteContextId, k, handoffPersonId)
        : allowAccessWithoutOwnership

      if (!authorized) {
        if (session?.user?.id) {
          await SecurityLogger.logPermissionDenied(session.user.id, 'signed-url.generate', k)
        }
        return NextResponse.json({ error: 'Access denied to one or more files' }, { status: 403 })
      }

      authorizedKeys.push(k)
    }

    // Generate signed URLs
    const expiry = expiresIn && typeof expiresIn === 'number' && expiresIn > 0 && expiresIn <= 86400
      ? expiresIn
      : 3600 // Default 1 hour, max 24 hours

    if (authorizedKeys.length === 1) {
      const signedUrl = await generateSignedUrl(authorizedKeys[0], { expiresIn: expiry })
      return NextResponse.json({ url: signedUrl })
    } else {
      const signedUrls = await generateSignedUrls(authorizedKeys, { expiresIn: expiry })
      return NextResponse.json({ urls: signedUrls })
    }

  } catch (error) {
    Logger.error('[signed-url] Error generating signed URLs', {
      error: error instanceof Error ? error.message : String(error)
    })
    return NextResponse.json({ error: 'Failed to generate signed URLs' }, { status: 500 })
  }
}
