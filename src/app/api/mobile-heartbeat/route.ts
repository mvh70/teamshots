import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

/**
 * POST /api/mobile-heartbeat?token=xxx
 * Unified heartbeat endpoint for both invite and handoff flows.
 * Updates the "last seen" timestamp so desktop can detect active connections.
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    const now = new Date()

    // Try MobileHandoffToken first
    const handoffToken = await prisma.mobileHandoffToken.findUnique({
      where: { token },
      select: { id: true }
    })

    if (handoffToken) {
      await prisma.mobileHandoffToken.update({
        where: { id: handoffToken.id },
        data: { lastUsedAt: now }
      })
      return NextResponse.json({ ok: true })
    }

    // Try TeamInvite
    const invite = await prisma.teamInvite.findFirst({
      where: { token },
      select: { id: true }
    })

    if (invite) {
      await prisma.teamInvite.update({
        where: { id: invite.id },
        data: { mobileLastSeenAt: now }
      })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Token not found' }, { status: 404 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
