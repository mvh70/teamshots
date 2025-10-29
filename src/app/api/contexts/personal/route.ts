import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's personal contexts only
    const individualContexts = await prisma.context.findMany({
      where: { 
        userId: session.user.id,
        companyId: null // Only personal contexts
      },
      orderBy: { createdAt: 'desc' }
    })

    // Get the user's active context ID from metadata
    const userWithMetadata = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { metadata: true }
    })

    let activeContext = null
    if ((userWithMetadata as { metadata?: unknown })?.metadata && typeof (userWithMetadata as { metadata?: unknown }).metadata === 'object') {
      const metadata = (userWithMetadata as { metadata?: Record<string, unknown> }).metadata as Record<string, unknown>
      if (metadata.activeContextId) {
        const list = individualContexts as Array<{ id: string }>
        activeContext = list.find((ctx: { id: string }) => ctx.id === (metadata.activeContextId as string)) || null
      }
    }

    return NextResponse.json({
      contexts: individualContexts,
      activeContext,
      contextType: 'personal'
    })

  } catch (error) {
    Logger.error('Error fetching personal contexts', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
