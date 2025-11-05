import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
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

    // Resolve ownership
    type OwnershipRecord =
      | { type: 'selfie'; personId: string | null; userId: string | null; teamId: string | null }
      | { type: 'generation'; personId: string | null; userId: string | null; teamId: string | null }
      | { type: 'context'; personId: null; userId: string | null; teamId: string | null }

    async function findFileOwnership(downloadKey: string): Promise<OwnershipRecord | null> {
      const trimmedKey = downloadKey.trim()
      if (!trimmedKey) return null

      const selfie = await prisma.selfie.findFirst({
        where: { OR: [{ key: trimmedKey }, { processedKey: trimmedKey }] },
        select: { personId: true, person: { select: { userId: true, teamId: true } } }
      })
      if (selfie) return { type: 'selfie', personId: selfie.personId, userId: selfie.person?.userId ?? null, teamId: selfie.person?.teamId ?? null }

      const generation = await prisma.generation.findFirst({
        where: {
          OR: [
            { uploadedPhotoKey: trimmedKey },
            { acceptedPhotoKey: trimmedKey },
            { generatedPhotoKeys: { has: trimmedKey } }
          ],
          deleted: false,
        },
        select: { personId: true, person: { select: { userId: true, teamId: true } } }
      })
      if (generation) return { type: 'generation', personId: generation.personId, userId: generation.person?.userId ?? null, teamId: generation.person?.teamId ?? null }

      const context = await prisma.context.findFirst({
        where: {
          OR: [
            { settings: { path: ['branding', 'logoKey'], equals: trimmedKey } },
            { settings: { path: ['background', 'key'], equals: trimmedKey } }
          ]
        },
        select: { userId: true, teamId: true }
      })
      if (context) return { type: 'context', personId: null, userId: context.userId ?? null, teamId: context.teamId ?? null }

      return null
    }

    function isAuthorized(
      ownership: OwnershipRecord,
      user: Awaited<ReturnType<typeof getUserWithRoles>> | null,
      roles: Awaited<ReturnType<typeof getUserEffectiveRoles>> | null,
      invitePersonId: string | null
    ): boolean {
      if (invitePersonId) {
        return ownership.personId !== null && ownership.personId === invitePersonId
      }
      if (!user || !roles) return false
      if (roles.isPlatformAdmin) return true
      const userPersonId = user.person?.id ?? null
      const userTeamId = user.person?.teamId ?? null
      const sameUser = ownership.userId !== null && ownership.userId === user.id
      const samePerson = ownership.personId !== null && userPersonId !== null && ownership.personId === userPersonId
      const sameTeam = ownership.teamId !== null && userTeamId !== null && ownership.teamId === userTeamId
      switch (ownership.type) {
        case 'selfie':
          return sameUser || samePerson || (sameTeam && roles.isTeamAdmin)
        case 'generation':
          return sameUser || samePerson || (sameTeam && roles.isTeamAdmin)
        case 'context':
          return sameUser || (sameTeam && (roles.isTeamAdmin || roles.isTeamMember))
        default:
          return false
      }
    }

    async function validateInviteToken(t: string | null): Promise<string | null> {
      if (!t) return null
      const invite = await prisma.teamInvite.findFirst({
        where: { token: t, usedAt: { not: null } },
        include: { person: { select: { id: true } } }
      })
      return invite?.person?.id ?? null
    }

    const ownership = await findFileOwnership(key)
    if (!ownership) return NextResponse.json({ error: 'File not found' }, { status: 404 })

    let invitePersonId: string | null = null
    if (!session?.user?.id && token) {
      invitePersonId = await validateInviteToken(token)
      if (!invitePersonId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    let userWithRoles = null
    let roles = null
    if (session?.user?.id) {
      userWithRoles = await getUserWithRoles(session.user.id)
      if (!userWithRoles) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      roles = await getUserEffectiveRoles(userWithRoles)
    }

    const authorized = isAuthorized(ownership, userWithRoles, roles, invitePersonId)
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


