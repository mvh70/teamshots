import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scope = request.nextUrl.searchParams.get('scope') || 'freePackage'
  const contextIdParam = request.nextUrl.searchParams.get('contextId')

  // If a specific contextId is provided, return that context directly (ownership checks could be added here)
  if (contextIdParam) {
    const ctx = await prisma.context.findUnique({ where: { id: contextIdParam }, select: { id: true, settings: true, stylePreset: true } })
    return NextResponse.json({ context: ctx ?? null, packageId: (ctx?.settings as Record<string, unknown> | null)?.['packageId'] ?? 'headshot1' })
  }

  if (scope === 'freePackage') {
    const setting = await prisma.appSetting.findUnique({ where: { key: 'freePackageStyleId' } })
    if (!setting?.value) return NextResponse.json({ context: null, packageId: 'freepackage' })
    const context = await prisma.context.findUnique({ where: { id: setting.value }, select: { id: true, settings: true, stylePreset: true } })
    return NextResponse.json({ context, packageId: (context?.settings as Record<string, unknown> | null)?.['packageId'] ?? 'freepackage' })
  }

  if (scope === 'individual') {
    // Latest personal context for this user
    const ctx = await prisma.context.findFirst({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, settings: true, stylePreset: true }
    })
    return NextResponse.json({ context: ctx ?? null, packageId: (ctx?.settings as Record<string, unknown> | null)?.['packageId'] ?? 'headshot1' })
  }

  if (scope === 'pro') {
    // Team active context if present; otherwise latest team context
    const person = await prisma.person.findFirst({ where: { userId: session.user.id }, select: { teamId: true } })
    if (!person?.teamId) return NextResponse.json({ context: null, packageId: 'headshot1' })
    const team = await prisma.team.findUnique({ where: { id: person.teamId }, select: { activeContextId: true } })
    let ctx = null as { id: string; settings: unknown; stylePreset: string } | null
    if (team?.activeContextId) {
      ctx = await prisma.context.findUnique({ where: { id: team.activeContextId }, select: { id: true, settings: true, stylePreset: true } })
    }
    if (!ctx) {
      ctx = await prisma.context.findFirst({
        where: { teamId: person.teamId },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, settings: true, stylePreset: true }
      })
    }
    return NextResponse.json({ context: ctx ?? null, packageId: (ctx?.settings as Record<string, unknown> | null)?.['packageId'] ?? 'headshot1' })
  }

  // Unknown scope
  return NextResponse.json({ context: null, packageId: 'headshot1' })
}


