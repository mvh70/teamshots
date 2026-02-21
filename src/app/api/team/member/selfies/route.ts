import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { getUsedSelfiesForPerson } from '@/domain/selfie/usage'
import { extractFromClassification } from '@/domain/selfie/selfie-types'
import { resolveInviteAccess } from '@/lib/invite-access'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const inviteAccess = await resolveInviteAccess({ token })
    if (!inviteAccess.ok) {
      return NextResponse.json({ error: inviteAccess.error.message }, { status: inviteAccess.error.status })
    }

    const person = inviteAccess.access.person

    // Get selfies for the person
    const selfies = await prisma.selfie.findMany({
      where: {
        personId: person.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        key: true,
        createdAt: true,
        userApproved: true,
        classification: true,
      }
    })

    // Get sets of used selfie IDs and keys
    const { usedSelfieIds, usedSelfieKeys } = await getUsedSelfiesForPerson(person.id)

    const items = selfies.map((selfie) => {
      const isUsed = usedSelfieIds.has(selfie.id) || usedSelfieKeys.has(selfie.key)
      const classification = extractFromClassification(selfie.classification)
      return {
        id: selfie.id,
        uploadedKey: selfie.key,
        validated: selfie.userApproved,
        createdAt: selfie.createdAt.toISOString(),
        hasGenerations: isUsed,
        selfieType: classification.selfieType,
        selfieTypeConfidence: classification.selfieTypeConfidence,
        isProper: classification.isProper,
        improperReason: classification.improperReason,
        lightingQuality: classification.lightingQuality,
        backgroundQuality: classification.backgroundQuality,
      }
    })

    // Backward-compatible shape for existing invite UI consumers.
    const tokenParam = `token=${encodeURIComponent(inviteAccess.access.token)}`
    const selfiesResponse = items.map((item) => {
      const url = `/api/files/get?key=${encodeURIComponent(item.uploadedKey)}&${tokenParam}`
      return {
        id: item.id,
        key: item.uploadedKey,
        url,
        uploadedAt: item.createdAt,
        status: item.validated ? 'approved' : 'uploaded',
        used: item.hasGenerations,
        selfieType: item.selfieType,
        selfieTypeConfidence: item.selfieTypeConfidence,
        isProper: item.isProper,
        improperReason: item.improperReason,
        lightingQuality: item.lightingQuality,
        backgroundQuality: item.backgroundQuality,
      }
    })

    return NextResponse.json({ items, selfies: selfiesResponse })
  } catch (error) {
    Logger.error('Error fetching selfies', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { token, selfieKey } = await request.json()

    if (!token || !selfieKey) {
      return NextResponse.json({ error: 'Missing token or selfieKey' }, { status: 400 })
    }

    const inviteAccess = await resolveInviteAccess({ token })
    if (!inviteAccess.ok) {
      return NextResponse.json({ error: inviteAccess.error.message }, { status: inviteAccess.error.status })
    }

    const person = inviteAccess.access.person

    // Create selfie record - auto-select since user explicitly approved in upload flow
    const selfie = await prisma.selfie.create({
      data: {
        personId: person.id,
        key: selfieKey,
        uploadedViaToken: token,
        selected: true
      }
    })

    // Queue classification (fire-and-forget with lazy import to avoid cold start delays)
    void (async () => {
      try {
        const { queueClassificationFromS3 } = await import('@/domain/selfie/selfie-classifier')
        const { s3Client, getS3BucketName } = await import('@/lib/s3-client')
        queueClassificationFromS3({
          selfieId: selfie.id,
          selfieKey: selfieKey,
          bucketName: getS3BucketName(),
          s3Client,
        }, 'team-member-selfies')
      } catch (err) {
        Logger.error('Failed to queue classification', {
          selfieId: selfie.id,
          error: err instanceof Error ? err.message : String(err)
        })
      }
    })()

    return NextResponse.json({ selfie })
  } catch (error) {
    Logger.error('Error creating selfie', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
