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

    // Get user's team information
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        person: {
          include: {
            team: {
              include: {
                contexts: {
                  where: { 
                    teamId: { not: null },
                    userId: null // Only team contexts
                  },
                  orderBy: { createdAt: 'desc' }
                },
                activeContext: true
              }
            }
          }
        }
      }
    })

    const teamId = (user as { person?: { team?: { id: string } } })?.person?.team?.id || null

    if (!teamId) {
      return NextResponse.json({ 
        error: 'User is not part of a team',
        contexts: [],
        activeContext: null,
        contextType: 'team'
      })
    }

    // Return team contexts with deserialized settings
    const teamData = (user as { person?: { team?: { contexts: Array<{ id: string; name: string | null; settings: unknown; packageName: string | null; createdAt: Date }>; activeContext: { id: string; name: string | null; settings: unknown; packageName: string | null; createdAt: Date } | null } } })?.person?.team
    const rawContexts = (teamData as { contexts: Array<{ id: string; name: string | null; settings: unknown; packageName: string | null; createdAt: Date }> }).contexts || []
    const rawActive = (teamData as { activeContext: { id: string; name: string | null; settings: unknown; packageName: string | null; createdAt: Date } | null }).activeContext || null

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

    const contexts = rawContexts.map(deserializeContext)
    const activeContext = rawActive ? deserializeContext(rawActive) : null

    return NextResponse.json({
      contexts,
      activeContext,
      contextType: 'team'
    })

  } catch (error) {
    Logger.error('Error fetching team contexts', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
