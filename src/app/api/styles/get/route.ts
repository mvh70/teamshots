import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getPackageConfig } from '@/domain/style/packages'

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
    if (!ctx) return NextResponse.json({ context: null, packageId: 'headshot1' })
    const pkg = getPackageConfig((ctx.settings as Record<string, unknown>)?.['packageId'] as string || 'headshot1')
    const ui = pkg.persistenceAdapter.deserialize((ctx.settings as Record<string, unknown>) || {})
    return NextResponse.json({ context: { ...ctx, settings: ui }, packageId: pkg.id })
  }

  if (scope === 'freePackage') {
    const setting = await prisma.appSetting.findUnique({ where: { key: 'freePackageStyleId' } })
    if (!setting?.value) return NextResponse.json({ context: null, packageId: 'freepackage' })
    const ctx = await prisma.context.findUnique({ where: { id: setting.value }, select: { id: true, settings: true, stylePreset: true } })
    if (!ctx) return NextResponse.json({ context: null, packageId: 'freepackage' })
    const pkg = getPackageConfig('freepackage')
    const ui = pkg.persistenceAdapter.deserialize((ctx.settings as Record<string, unknown>) || {})
    const context = { ...ctx, settings: ui }
    return NextResponse.json({ context, packageId: 'freepackage' })
  }

  if (scope === 'individual') {
    // Latest personal context for this user
    const ctx = await prisma.context.findFirst({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, settings: true, stylePreset: true }
    })
    if (!ctx) return NextResponse.json({ context: null, packageId: 'headshot1' })
    const pkg = getPackageConfig((ctx.settings as Record<string, unknown>)?.['packageId'] as string || 'headshot1')
    const ui = pkg.persistenceAdapter.deserialize((ctx.settings as Record<string, unknown>) || {})
    return NextResponse.json({ context: { ...ctx, settings: ui }, packageId: pkg.id })
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
    if (!ctx) return NextResponse.json({ context: null, packageId: 'headshot1' })
    const pkg = getPackageConfig((ctx.settings as Record<string, unknown>)?.['packageId'] as string || 'headshot1')
    const ui = pkg.persistenceAdapter.deserialize((ctx.settings as Record<string, unknown>) || {})
    return NextResponse.json({ context: { ...ctx, settings: ui }, packageId: pkg.id })
  }

  // Unknown scope
  return NextResponse.json({ context: null, packageId: 'headshot1' })
}


