import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { auth } from '@/auth'
import { Logger } from '@/lib/logger'
import { SecurityLogger } from '@/lib/security-logger'
import { createS3Client, getS3BucketName, getS3Key } from '@/lib/s3-client'
import { RATE_LIMITS } from '@/config/rate-limit-config'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rate-limit'
import { getUserEffectiveRoles, getUserWithRoles } from '@/domain/access/roles'
import { getUserSubscription } from '@/domain/subscription/subscription'
import { findFileOwnership, validateInviteToken, isFileAuthorized } from '@/lib/file-ownership'


export const runtime = 'nodejs'
const s3 = createS3Client()
const bucket = getS3BucketName()

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const key = searchParams.get('key')
    if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 })

    const session = await auth()
    const token = searchParams.get('token')
    if (!session?.user?.id && !token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit (reuse filesGet tier)
    const rateConfig = RATE_LIMITS.filesGet ?? RATE_LIMITS.api
    let rateIdentifier: string
    if (session?.user?.id) {
      rateIdentifier = `files-download:user:${session.user.id}`
    } else if (token) {
      rateIdentifier = `files-download:token:${token}`
    } else {
      rateIdentifier = await getRateLimitIdentifier(req, 'files-download')
    }
    const rateResult = await checkRateLimit(rateIdentifier, rateConfig.limit, rateConfig.window)
    if (!rateResult.success) {
      await SecurityLogger.logRateLimitExceeded(rateIdentifier)
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': Math.ceil((rateResult.reset - Date.now()) / 1000).toString() } }
      )
    }

    let invitePersonId: string | null = null
    let inviteTeamId: string | null = null
    if (!session?.user?.id && token) {
      const inviteData = await validateInviteToken(token)
      if (!inviteData) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
      invitePersonId = inviteData.personId
      inviteTeamId = inviteData.teamId
    }

    let userWithRoles = null
    let roles = null
    if (session?.user?.id) {
      // OPTIMIZATION: Fetch subscription in parallel with user to avoid duplicate queries
      const [user, subscription] = await Promise.all([
        getUserWithRoles(session.user.id),
        getUserSubscription(session.user.id)
      ])
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      userWithRoles = user
      // Pass subscription to avoid duplicate query
      roles = await getUserEffectiveRoles(user, subscription)
    }

    const ownership = await findFileOwnership(key)
    
    // Special case: Allow access to background/logo files users uploaded
    // even if not yet saved to a context (e.g., during style customization)
    let allowAccessWithoutOwnership = false
    if (!ownership) {
      if (invitePersonId && (key.startsWith(`backgrounds/${invitePersonId}/`) || key.startsWith(`logos/${invitePersonId}/`))) {
        allowAccessWithoutOwnership = true
      } else if (userWithRoles?.person?.id && (key.startsWith(`backgrounds/${userWithRoles.person.id}/`) || key.startsWith(`logos/${userWithRoles.person.id}/`))) {
        allowAccessWithoutOwnership = true
      } else {
        return NextResponse.json({ error: 'File not found' }, { status: 404 })
      }
    }

    const authorized = ownership ? isFileAuthorized(ownership, userWithRoles, roles, invitePersonId, inviteTeamId, key) : allowAccessWithoutOwnership
    if (!authorized) {
      if (session?.user?.id) {
        await SecurityLogger.logPermissionDenied(session.user.id, 'files.download', key)
      }
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // key from query param is relative (from database), add folder prefix if configured
    const s3Key = getS3Key(key)
    const command = new GetObjectCommand({ Bucket: bucket, Key: s3Key })
    const url = await getSignedUrl(s3, command, { expiresIn: 60 })
    return NextResponse.json({ url })
  } catch (e) {
    Logger.error('[files/download] error', { error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json({ error: 'Failed to sign download' }, { status: 500 })
  }
}


