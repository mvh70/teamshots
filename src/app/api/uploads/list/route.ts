import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { getUsedSelfiesForPerson } from '@/domain/selfie/usage'


export const runtime = 'nodejs'
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get selfies for the user
    const uploads = await prisma.selfie.findMany({
      where: { person: { userId: session.user.id } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        key: true,
        validated: true,
        createdAt: true,
        selfieType: true,
        selfieTypeConfidence: true,
        personCount: true,
        isProper: true,
        improperReason: true,
        lightingQuality: true,
        lightingFeedback: true,
        backgroundQuality: true,
        backgroundFeedback: true,
      }
    })

    // Get person ID for generation queries
    const person = await prisma.person.findUnique({
      where: { userId: session.user.id },
      select: { id: true }
    })

    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    }

    // Get sets of used selfie IDs and keys
    const { usedSelfieIds, usedSelfieKeys } = await getUsedSelfiesForPerson(person.id)

    const items = uploads.map((u: {
      id: string
      key: string
      validated: boolean
      createdAt: Date
      selfieType: string | null
      selfieTypeConfidence: number | null
      personCount: number | null
      isProper: boolean | null
      improperReason: string | null
      lightingQuality: string | null
      lightingFeedback: string | null
      backgroundQuality: string | null
      backgroundFeedback: string | null
    }) => {
      // Check if selfie is used: either by ID or by key
      const isUsed = usedSelfieIds.has(u.id) || usedSelfieKeys.has(u.key)
      return {
        id: u.id,
        uploadedKey: u.key,
        validated: u.validated,
        createdAt: u.createdAt.toISOString(),
        hasGenerations: isUsed,
        selfieType: u.selfieType,
        selfieTypeConfidence: u.selfieTypeConfidence,
        personCount: u.personCount,
        isProper: u.isProper,
        improperReason: u.improperReason,
        lightingQuality: u.lightingQuality,
        lightingFeedback: u.lightingFeedback,
        backgroundQuality: u.backgroundQuality,
        backgroundFeedback: u.backgroundFeedback,
      }
    })

    return NextResponse.json({ items })
  } catch (e) {
    Logger.error('[uploads/list] error', { error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json({ error: 'Failed to load uploads' }, { status: 500 })
  }
}


