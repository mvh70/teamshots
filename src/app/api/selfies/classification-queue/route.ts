import { NextRequest, NextResponse } from 'next/server'
import { classificationQueue } from '@/lib/classification-queue'
import { auth } from '@/auth'
import { prisma, Prisma } from '@/lib/prisma'
import { validateMobileHandoffToken } from '@/lib/mobile-handoff'

export const runtime = 'nodejs'

/**
 * GET /api/selfies/classification-queue
 * 
 * Returns the current classification queue status, including which selfie IDs
 * are actively being analyzed vs queued (waiting).
 * 
 * Supports both authenticated users and token-based access (invite/handoff).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token') || undefined
    const handoffToken = searchParams.get('handoffToken') || undefined

    // Determine person based on auth method
    let personId: string | null = null

    if (handoffToken) {
      // Mobile handoff token auth
      const result = await validateMobileHandoffToken(handoffToken)
      if (!result.success) {
        return NextResponse.json({ error: result.error, code: result.code }, { status: 401 })
      }
      personId = result.context.personId || null
    } else if (token) {
      // Invite token auth
      const invite = await prisma.teamInvite.findFirst({
        where: { token, usedAt: { not: null } },
        include: { person: { select: { id: true } } },
      })
      personId = invite?.person?.id || null
    } else {
      // Session auth
      const session = await auth()
      if (session?.user?.id) {
        const person = await prisma.person.findUnique({
          where: { userId: session.user.id },
          select: { id: true },
        })
        personId = person?.id || null
      }
    }

    // If no person found, return empty status (graceful degradation)
    if (!personId) {
      return NextResponse.json({
        activeSelfieIds: [],
        queuedSelfieIds: [],
        queueStats: {
          running: 0,
          queued: 0,
          maxConcurrent: 3,
        },
      })
    }

    // Get queue status
    const queueStatus = classificationQueue.getStatus()

    // Get the user's selfies that don't have classification data yet
    const unclassifiedSelfies = await prisma.selfie.findMany({
      where: {
        personId,
        classification: { equals: Prisma.DbNull },
      },
      select: { id: true },
    })

    const unclassifiedIds = unclassifiedSelfies.map(s => s.id)

    // Filter to only include the user's selfies in the status
    const userActiveSelfieIds = queueStatus.activeSelfieIds.filter(id => unclassifiedIds.includes(id))
    const userQueuedSelfieIds = queueStatus.queuedSelfieIds.filter(id => unclassifiedIds.includes(id))

    return NextResponse.json({
      activeSelfieIds: userActiveSelfieIds,
      queuedSelfieIds: userQueuedSelfieIds,
      queueStats: {
        running: queueStatus.running,
        queued: queueStatus.queued,
        maxConcurrent: queueStatus.maxConcurrent,
      },
    })
  } catch (error) {
    console.error('[classification-queue] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
