/**
 * Extension Styles API Endpoint
 *
 * GET /api/extensions/styles
 *
 * Returns the user's defined photo styles (contexts) for use in the Chrome extension.
 * Supports extension token authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getExtensionAuthFromHeaders, EXTENSION_SCOPES } from '@/domain/extension'
import { Logger } from '@/lib/logger'
import { handleCorsPreflightSync, addCorsHeaders } from '@/lib/cors'

export const runtime = 'nodejs'

/**
 * OPTIONS /api/extensions/styles
 * Handle CORS preflight requests
 */
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin')
  const response = handleCorsPreflightSync(origin)
  return response || new NextResponse(null, { status: 204 })
}

/**
 * GET /api/extensions/styles
 *
 * Returns available photo styles for the authenticated user
 */
export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin')

  try {
    // Authenticate via extension token
    const extensionAuth = await getExtensionAuthFromHeaders(
      req.headers,
      EXTENSION_SCOPES.GENERATION_CREATE // Reuse generation scope for style access
    )

    if (!extensionAuth) {
      return addCorsHeaders(
        NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
        origin
      )
    }

    const userId = extensionAuth.userId

    // Get user's team information
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        person: {
          include: {
            team: {
              include: {
                contexts: {
                  orderBy: { createdAt: 'desc' },
                  select: {
                    id: true,
                    name: true,
                    settings: true,
                    createdAt: true,
                  }
                },
                activeContext: {
                  select: {
                    id: true,
                    name: true,
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!user) {
      return addCorsHeaders(
        NextResponse.json({ error: 'User not found' }, { status: 404 }),
        origin
      )
    }

    const teamId = (user as { person?: { team?: { id: string } } })?.person?.team?.id || null

    let styles: Array<{ id: string; name: string; isActive: boolean; packageId?: string }> = []
    let activeStyleId: string | null = null

    if (teamId) {
      // User is part of a team - return team contexts
      const teamData = (user as { person?: { team?: { contexts: Array<{ id: string; name: string; settings: unknown }>; activeContext: { id: string } | null } } })?.person?.team
      const teamContexts = teamData?.contexts || []
      const teamActive = teamData?.activeContext

      activeStyleId = teamActive?.id || null

      styles = teamContexts.map(ctx => ({
        id: ctx.id,
        name: ctx.name,
        isActive: ctx.id === activeStyleId,
        packageId: (ctx.settings as { package?: string })?.package || 'headshot1'
      }))
    } else {
      // Individual user - return personal contexts
      const individualContexts = await prisma.context.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          settings: true,
          createdAt: true,
        }
      })

      // Get the user's active context ID from metadata
      const userWithMetadata = await prisma.user.findUnique({
        where: { id: userId },
        select: { metadata: true }
      })

      if ((userWithMetadata as { metadata?: unknown })?.metadata && typeof (userWithMetadata as { metadata?: unknown }).metadata === 'object') {
        const metadata = (userWithMetadata as { metadata?: Record<string, unknown> }).metadata as Record<string, unknown>
        activeStyleId = (metadata.activeContextId as string) || null
      }

      styles = individualContexts.map(ctx => ({
        id: ctx.id,
        name: ctx.name,
        isActive: ctx.id === activeStyleId,
        packageId: (ctx.settings as { package?: string })?.package || 'headshot1'
      }))
    }

    // Filter to only outfit1 package styles (for the outfit transfer extension)
    const outfit1Styles = styles.filter(s => s.packageId === 'outfit1')

    Logger.debug('[ExtensionStyles] Returning styles', {
      userId,
      totalStyles: styles.length,
      outfit1Styles: outfit1Styles.length,
      activeStyleId,
    })

    return addCorsHeaders(
      NextResponse.json({
        styles: outfit1Styles,
        activeStyleId,
        hasStyles: outfit1Styles.length > 0,
      }),
      origin
    )

  } catch (error) {
    Logger.error('[ExtensionStyles] Error fetching styles', {
      error: error instanceof Error ? error.message : String(error),
    })
    return addCorsHeaders(
      NextResponse.json({ error: 'Failed to fetch styles' }, { status: 500 }),
      origin
    )
  }
}
