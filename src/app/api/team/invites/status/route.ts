import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isRecentlyActive } from '@/lib/mobile-handoff'

export const runtime = 'nodejs'

/**
 * GET /api/team/invites/status?token=xxx
 * Get the status of an invite token for desktop polling.
 * Returns selfie count and last activity for the invitee.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    // Find the invite and person
    const invite = await prisma.teamInvite.findFirst({
      where: {
        token,
        usedAt: { not: null }
      },
      select: {
        id: true,
        personId: true,
        mobileLastSeenAt: true,
        updatedAt: true
      }
    })

    if (!invite || !invite.personId) {
      return NextResponse.json({
        valid: false,
        error: 'Invalid or expired invite'
      }, { status: 404 })
    }

    // Get selfie count for the invitee
    const selfieCount = await prisma.selfie.count({
      where: { personId: invite.personId }
    })

    // Get the most recent selfie upload time
    const latestSelfie = await prisma.selfie.findFirst({
      where: { personId: invite.personId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    })

    return NextResponse.json({
      valid: true,
      selfieCount,
      lastUploadAt: latestSelfie?.createdAt?.toISOString() || null,
      deviceConnected: isRecentlyActive(invite.mobileLastSeenAt)
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
