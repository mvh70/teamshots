import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getExtensionAuthFromHeaders, EXTENSION_SCOPES } from '@/domain/extension'
import { handleCorsPreflightSync, addCorsHeaders } from '@/lib/cors'

export const runtime = 'nodejs'

/**
 * OPTIONS /api/selfies/[id]/select
 * Handle CORS preflight requests for extension support
 */
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin')
  const response = handleCorsPreflightSync(origin)
  return response || new NextResponse(null, { status: 204 })
}
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
  const origin = request.headers.get('origin')

  try {
    const { id } = await params

    // Parse payload once here
    const payload = await request.json().catch(() => ({})) as { selected?: boolean; token?: string }
    if (typeof payload.selected !== 'boolean') {
      return addCorsHeaders(
        NextResponse.json({ error: 'Invalid payload' }, { status: 400 }),
        origin
      )
    }

    // Load selfie and owner
    const selfie = await prisma.selfie.findUnique({
      where: { id },
      include: { person: { select: { id: true, userId: true, inviteToken: true } } }
    })

    if (!selfie) {
      return addCorsHeaders(
        NextResponse.json({ error: 'Not found' }, { status: 404 }),
        origin
      )
    }

    if (!selfie.person) {
      return addCorsHeaders(
        NextResponse.json({ error: 'Selfie has no associated person' }, { status: 400 }),
        origin
      )
    }

    // Try extension token auth first
    const extensionAuth = await getExtensionAuthFromHeaders(
      request.headers,
      EXTENSION_SCOPES.GENERATION_CREATE
    )

    // Fall back to session auth
    const session = extensionAuth ? null : await auth()

    // AuthZ: allow either (a) owner session, (b) extension token for owner, or (c) valid invite token for owner
    const isOwnerViaSession = Boolean(session?.user?.id && selfie.person.userId === session.user.id)
    const isOwnerViaExtension = Boolean(extensionAuth?.userId && selfie.person.userId === extensionAuth.userId)
    const isOwner = isOwnerViaSession || isOwnerViaExtension

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
      return addCorsHeaders(
        NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
        origin
      )
    }

    // Temporarily cast due to prisma types needing regeneration after migration
    const updated = await prisma.selfie.update({
      where: { id },
      data: { selected: payload.selected } as unknown as Record<string, unknown>
    })

    return addCorsHeaders(
      NextResponse.json({ id: updated.id, selected: payload.selected }),
      origin
    )
  } catch (error) {
    console.error('Error updating selfie selection:', error)
    return addCorsHeaders(
      NextResponse.json({ error: 'Server error' }, { status: 500 }),
      request.headers.get('origin')
    )
  }
}
