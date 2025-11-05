import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { SecurityLogger } from '@/lib/security-logger'
import { createS3Client, getS3BucketName, getS3Key } from '@/lib/s3-client'
import { RATE_LIMITS } from '@/config/rate-limit-config'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rate-limit'
import { getUserEffectiveRoles, getUserWithRoles } from '@/domain/access/roles'

const s3 = createS3Client()
const bucket = getS3BucketName()

type OwnershipRecord =
  | { type: 'selfie'; personId: string | null; userId: string | null; teamId: string | null }
  | { type: 'generation'; personId: string | null; userId: string | null; teamId: string | null }
  | { type: 'context'; personId: null; userId: string | null; teamId: string | null }

async function findFileOwnership(key: string): Promise<OwnershipRecord | null> {
  const trimmedKey = key.trim()

  if (!trimmedKey) {
    return null
  }

  const selfie = await prisma.selfie.findFirst({
    where: {
      OR: [
        { key: trimmedKey },
        { processedKey: trimmedKey },
      ],
    },
    select: {
      personId: true,
      person: {
        select: {
          userId: true,
          teamId: true,
        },
      },
    },
  })

  if (selfie) {
    return {
      type: 'selfie',
      personId: selfie.personId,
      userId: selfie.person?.userId ?? null,
      teamId: selfie.person?.teamId ?? null,
    }
  }

  const generation = await prisma.generation.findFirst({
    where: {
      OR: [
        { uploadedPhotoKey: trimmedKey },
        { acceptedPhotoKey: trimmedKey },
        { generatedPhotoKeys: { has: trimmedKey } },
      ],
      deleted: false,
    },
    select: {
      personId: true,
      person: {
        select: {
          userId: true,
          teamId: true,
        },
      },
    },
  })

  if (generation) {
    return {
      type: 'generation',
      personId: generation.personId,
      userId: generation.person?.userId ?? null,
      teamId: generation.person?.teamId ?? null,
    }
  }

  const context = await prisma.context.findFirst({
    where: {
      OR: [
        { settings: { path: ['branding', 'logoKey'], equals: trimmedKey } },
        { settings: { path: ['background', 'key'], equals: trimmedKey } },
      ],
    },
    select: {
      userId: true,
      teamId: true,
    },
  })

  if (context) {
    return {
      type: 'context',
      personId: null,
      userId: context.userId ?? null,
      teamId: context.teamId ?? null,
    }
  }

  return null
}

function isSessionAuthorized(
  ownership: OwnershipRecord,
  user: Awaited<ReturnType<typeof getUserWithRoles>>,
  roles: Awaited<ReturnType<typeof getUserEffectiveRoles>>
): boolean {
  if (!user) {
    return false
  }

  if (roles.isPlatformAdmin) {
    return true
  }

  const userPersonId = user.person?.id ?? null
  const userTeamId = user.person?.teamId ?? null

  const sameUser = ownership.userId !== null && ownership.userId === user.id
  const samePerson = ownership.personId !== null && userPersonId !== null && ownership.personId === userPersonId
  const sameTeam = ownership.teamId !== null && userTeamId !== null && ownership.teamId === userTeamId

  switch (ownership.type) {
    case 'selfie':
      if (sameUser || samePerson) {
        return true
      }
      if (sameTeam && roles.isTeamAdmin) {
        return true
      }
      return false
    case 'generation':
      if (sameUser || samePerson) {
        return true
      }
      if (sameTeam && roles.isTeamAdmin) {
        return true
      }
      return false
    case 'context':
      if (sameUser) {
        return true
      }
      if (sameTeam && (roles.isTeamAdmin || roles.isTeamMember)) {
        return true
      }
      return false
    default:
      return false
  }
}

async function validateInviteToken(token: string | null) {
  if (!token) {
    return null
  }

  const invite = await prisma.teamInvite.findFirst({
    where: {
      token,
      usedAt: { not: null },
    },
    include: {
      person: {
        select: {
          id: true,
        },
      },
    },
  })

  if (!invite?.person) {
    return null
  }

  return invite.person.id
}

function isInviteAuthorized(ownership: OwnershipRecord, invitePersonId: string): boolean {
  if (!ownership.personId) {
    return false
  }
  return ownership.personId === invitePersonId
}

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
      userWithRoles = await getUserWithRoles(session.user.id)
      if (!userWithRoles) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      roles = await getUserEffectiveRoles(userWithRoles)
    }

    const ownership = await findFileOwnership(key)
    if (!ownership) {
      return fileNotFoundResponse()
    }

    let authorized = false
    if (invitePersonId) {
      authorized = isInviteAuthorized(ownership, invitePersonId)
    } else if (userWithRoles && roles) {
      authorized = isSessionAuthorized(ownership, userWithRoles, roles)
    }

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

