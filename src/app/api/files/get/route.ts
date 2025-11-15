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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')
  if (!key) {
    return NextResponse.json({ error: 'Missing key' }, { status: 400 })
  }

  try {
    const session = await auth()
    const token = searchParams.get('token')

    if (!session?.user?.id && !token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rateConfig = RATE_LIMITS.filesGet ?? RATE_LIMITS.api
    let rateIdentifier: string

    if (session?.user?.id) {
      rateIdentifier = `files-get:user:${session.user.id}`
    } else if (token) {
      rateIdentifier = `files-get:token:${token}`
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
    if (!session?.user?.id && token) {
      invitePersonId = await validateInviteToken(token)
      if (!invitePersonId) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
      }
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
    if (!ownership) {
      return fileNotFoundResponse()
    }

    const authorized = isFileAuthorized(ownership, userWithRoles, roles, invitePersonId)

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

