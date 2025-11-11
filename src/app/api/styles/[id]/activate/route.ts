import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { setActiveStyleServer } from '../../_service'

type ResolveResult =
  | { context: { id: string; teamId: string | null; userId: string | null }; scope: 'pro' | 'individual' }
  | { error: { status: number; message: string } }

async function resolveActivationContext(contextId: string, userId: string): Promise<ResolveResult> {
  const context = await prisma.context.findUnique({
    where: { id: contextId },
    select: { id: true, teamId: true, userId: true }
  })

  if (!context) {
    return { error: { status: 404, message: 'Context not found' } }
  }

  if (context.teamId) {
    const membership = await prisma.person.findFirst({
      where: { userId, teamId: context.teamId },
      select: { id: true }
    })

    if (!membership) {
      return { error: { status: 403, message: 'Forbidden' } }
    }

    return { context, scope: 'pro' }
  }

  if (context.userId && context.userId !== userId) {
    return { error: { status: 403, message: 'Forbidden' } }
  }

  return { context, scope: 'individual' }
}


export const runtime = 'nodejs'
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolution = await resolveActivationContext(id, session.user.id)
    if ('error' in resolution) {
      return NextResponse.json(
        { error: resolution.error.message },
        { status: resolution.error.status }
      )
    }

    await setActiveStyleServer({
      scope: resolution.scope,
      userId: session.user.id,
      styleId: resolution.context.id
    })

    return NextResponse.json({
      success: true,
      context: resolution.context
    })

  } catch (error) {
    Logger.error('Error activating context', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolution = await resolveActivationContext(id, session.user.id)
    if ('error' in resolution) {
      return NextResponse.json(
        { error: resolution.error.message },
        { status: resolution.error.status }
      )
    }

    await setActiveStyleServer({
      scope: resolution.scope,
      userId: session.user.id,
      styleId: null
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    Logger.error('Error deactivating context', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}