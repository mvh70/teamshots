import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { getPackageConfig } from '@/domain/style/packages'
import { extractPackageId } from '@/domain/style/settings-resolver'


export const runtime = 'nodejs'
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's personal contexts only
    const rawContexts = await prisma.context.findMany({
      where: { 
        userId: session.user.id,
        teamId: null // Only personal contexts
      },
      orderBy: { createdAt: 'desc' }
    })

    // Deserialize settings for each context
    const deserializeContext = (ctx: { id: string; name: string | null; settings: unknown; packageName: string | null; createdAt: Date }) => {
      const packageId = extractPackageId(ctx.settings as Record<string, unknown>) || ctx.packageName || 'headshot1'
      const pkg = getPackageConfig(packageId)
      const deserializedSettings = pkg.persistenceAdapter.deserialize(ctx.settings as Record<string, unknown>) as Record<string, unknown>
      
      // Only inject shotType from package defaults if not already in settings (for clothing color exclusions)
      const finalSettings = deserializedSettings.shotType
        ? deserializedSettings
        : {
            ...deserializedSettings,
            shotType: pkg.defaultSettings.shotType
          }
      
      return {
        ...ctx,
        packageId,
        settings: finalSettings
      }
    }

    const individualContexts = rawContexts.map(deserializeContext)

    // Get the user's active context ID from metadata
    const userWithMetadata = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { metadata: true }
    })

    let activeContext = null
    if ((userWithMetadata as { metadata?: unknown })?.metadata && typeof (userWithMetadata as { metadata?: unknown }).metadata === 'object') {
      const metadata = (userWithMetadata as { metadata?: Record<string, unknown> }).metadata as Record<string, unknown>
      if (metadata.activeContextId) {
        const rawActive = rawContexts.find((ctx: { id: string }) => ctx.id === (metadata.activeContextId as string))
        activeContext = rawActive ? deserializeContext(rawActive) : null
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
