import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { resolveInviteAccess } from '@/lib/invite-access'


export const runtime = 'nodejs'
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token') || undefined

    // Resolve person: prioritize invite token when present (invite dashboard use-case)
    let personId: string | null = null
    let inviteTokenRejected = false
    if (token) {
      // Check for team invite token via canonical access validation
      const inviteAccess = await resolveInviteAccess({ token })
      if (inviteAccess.ok) {
        personId = inviteAccess.access.person.id
      } else {
        inviteTokenRejected = true
      }

      // If not found, check for mobile handoff token
      if (!personId) {
        const handoffToken = await prisma.mobileHandoffToken.findFirst({
          where: {
            token,
            expiresAt: { gt: new Date() },
            absoluteExpiry: { gt: new Date() }
          },
          select: { personId: true }
        })
        personId = handoffToken?.personId || null
      }
    }
    // Fallback to session user when no valid token mapping
    if (!personId && session?.user?.id) {
      const person = await prisma.person.findUnique({ where: { userId: session.user.id }, select: { id: true } })
      personId = person?.id || null
    }

    if (!personId && token && inviteTokenRejected) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!personId) {
      return NextResponse.json({ selfies: [] }, { status: 200 })
    }

    const selfies = await prisma.selfie.findMany({
      where: { personId, selected: true },
      orderBy: { createdAt: 'desc' },
      select: { id: true, key: true, selected: true, validated: true, createdAt: true }
    })

    return NextResponse.json({ selfies })
  } catch {
    return NextResponse.json({ selfies: [] }, { status: 200 })
  }
}
