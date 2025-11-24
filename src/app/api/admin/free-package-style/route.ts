import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } })
  if (!user?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  type PrismaWithAppSetting = typeof prisma & { appSetting: { findUnique: (...args: unknown[]) => Promise<{ key: string; value: string } | null> } }
  const prismaEx = prisma as unknown as PrismaWithAppSetting
  const setting = await prismaEx.appSetting.findUnique({ where: { key: 'freePackageStyleId' } })
  const freePackageStyleId = setting?.value || null

  if (!freePackageStyleId) {
    return NextResponse.json({ freePackageStyleId: null })
  }

  // Load the saved context to hydrate UI with persisted values
  const context = await prisma.context.findUnique({
    where: { id: freePackageStyleId },
    select: { id: true, settings: true }
  })

  // Extract stylePreset from settings if it exists
  const settings = context?.settings as Record<string, unknown> | undefined
  const stylePreset = settings?.stylePreset as string | undefined

  return NextResponse.json({
    freePackageStyleId,
    context: context ? { ...context, stylePreset } : null
  })
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } })
  if (!user?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { freePackageStyleId } = await request.json()
  if (!freePackageStyleId || typeof freePackageStyleId !== 'string') {
    return NextResponse.json({ error: 'freePackageStyleId is required' }, { status: 400 })
  }
  type PrismaWithAppSettingMut = typeof prisma & { appSetting: { upsert: (...args: unknown[]) => Promise<unknown> } }
  const prismaExMut = prisma as unknown as PrismaWithAppSettingMut
  await prismaExMut.appSetting.upsert({
    where: { key: 'freePackageStyleId' },
    update: { value: freePackageStyleId },
    create: { key: 'freePackageStyleId', value: freePackageStyleId },
  })
  return NextResponse.json({ success: true })
}


