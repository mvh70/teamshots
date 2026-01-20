import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { getUsedSelfiesForPerson } from '@/domain/selfie/usage'
import { extendInviteExpiry } from '@/lib/invite-utils'
import { queueClassificationFromS3 } from '@/domain/selfie/selfie-classifier'
import { s3Client, getS3BucketName } from '@/lib/s3-client'
import { extractFromClassification } from '@/domain/selfie/selfie-types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    // Validate the token and get person data
    const invite = await prisma.teamInvite.findFirst({
      where: {
        token,
        usedAt: { not: null }
      },
      include: {
        person: true
      }
    })

    if (!invite) {
      return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 401 })
    }

    // Extend invite expiry (sliding expiration) - don't await to avoid blocking
    extendInviteExpiry(invite.id).catch(() => {
      // Silently fail - expiry extension is best effort
    })

    if (!invite.person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    }

    const person = invite.person

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

    // Transform selfies to include URLs and proper field names
    const tokenParam = `token=${encodeURIComponent(token)}`

    const transformedSelfies = selfies.map((selfie) => {
      const url = `/api/files/get?key=${encodeURIComponent(selfie.key)}&${tokenParam}`
      Logger.info('Generated selfie URL', { url, key: selfie.key })
      // Check if selfie is used: either by ID or by key
      const isUsed = usedSelfieIds.has(selfie.id) || usedSelfieKeys.has(selfie.key)
      // Extract classification fields from JSON
      const classification = extractFromClassification(selfie.classification)
      return {
        id: selfie.id,
        key: selfie.key,
        url,
        uploadedAt: selfie.createdAt.toISOString(),
        status: selfie.userApproved ? 'approved' : 'uploaded',
        used: isUsed,
        selfieType: classification.selfieType,
        selfieTypeConfidence: classification.selfieTypeConfidence,
        isProper: classification.isProper,
        improperReason: classification.improperReason,
        lightingQuality: classification.lightingQuality,
        backgroundQuality: classification.backgroundQuality
      }
    })

    return NextResponse.json({ selfies: transformedSelfies })
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

    // Validate the token and get person data
    const invite = await prisma.teamInvite.findFirst({
      where: {
        token,
        usedAt: { not: null }
      },
      include: {
        person: true
      }
    })

    if (!invite) {
      return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 401 })
    }

    // Extend invite expiry (sliding expiration) - don't await to avoid blocking
    extendInviteExpiry(invite.id).catch(() => {
      // Silently fail - expiry extension is best effort
    })

    if (!invite.person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    }

    const person = invite.person

    // Create selfie record - auto-select since user explicitly approved in upload flow
    const selfie = await prisma.selfie.create({
      data: {
        personId: person.id,
        key: selfieKey,
        uploadedViaToken: token,
        selected: true
      }
    })

    // Queue classification (fire-and-forget)
    queueClassificationFromS3({
      selfieId: selfie.id,
      selfieKey: selfieKey,
      bucketName: getS3BucketName(),
      s3Client,
    }, 'team-member-selfies')

    return NextResponse.json({ selfie })
  } catch (error) {
    Logger.error('Error creating selfie', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
