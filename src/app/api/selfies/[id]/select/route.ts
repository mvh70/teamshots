import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'


export const runtime = 'nodejs'
async function getInviteToken(req: Request): Promise<string | undefined> {
  const url = new URL(req.url)
  const fromQuery = url.searchParams.get('token') || undefined
  // Some clients send via custom header
  const fromHeader = req.headers.get('x-invite-token') || undefined
  return fromQuery || fromHeader
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    // Parse payload once here
    const payload = await request.json().catch(() => ({})) as { selected?: boolean; token?: string }
    if (typeof payload.selected !== 'boolean') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    // Load selfie and owner
    const selfie = await prisma.selfie.findUnique({
      where: { id },
      include: { person: { select: { id: true, userId: true, inviteToken: true } } }
    })

    if (!selfie) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (!selfie.person) {
      return NextResponse.json({ error: 'Selfie has no associated person' }, { status: 400 })
    }

    // AuthZ: allow either (a) owner session or (b) valid invite token for owner
    const isOwner = Boolean(session?.user?.id && selfie.person.userId === session.user.id)

    // Prefer token in payload; also check query/header for robustness
    const token = payload.token || (await getInviteToken(request))
    let hasValidToken = Boolean(token && selfie.person.inviteToken && token === selfie.person.inviteToken)

    // Also allow valid TeamInvite token for this person (invite dashboards use TeamInvite.token)
    if (!hasValidToken && token && selfie.person.id) {
      try {
        const invite = await prisma.teamInvite.findFirst({
          where: { token, usedAt: { not: null }, personId: selfie.person.id },
          select: { id: true, personId: true }
        })
        if (invite && invite.personId === selfie.person.id) {
          hasValidToken = true
        }
      } catch (error) {
        // Log error but continue with other checks
        console.error('Error checking TeamInvite token:', error)
      }
    }

    // Also allow valid MobileHandoffToken for this person (mobile handoff QR flow)
    if (!hasValidToken && token && selfie.person.id) {
      try {
        const handoffToken = await prisma.mobileHandoffToken.findFirst({
          where: {
            token,
            personId: selfie.person.id,
            expiresAt: { gt: new Date() },
            absoluteExpiry: { gt: new Date() }
          },
          select: { id: true, personId: true }
        })
        if (handoffToken && handoffToken.personId === selfie.person.id) {
          hasValidToken = true
        }
      } catch (error) {
        // Log error but continue with other checks
        console.error('Error checking MobileHandoffToken:', error)
      }
    }

    if (!isOwner && !hasValidToken) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Temporarily cast due to prisma types needing regeneration after migration
    const updated = await prisma.selfie.update({
      where: { id },
      data: { selected: payload.selected } as unknown as Record<string, unknown>
    })

    return NextResponse.json({ id: updated.id, selected: payload.selected })
  } catch (error) {
    console.error('Error updating selfie selection:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
