import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { createOrUpdateStyleServer, setActiveStyleServer } from './_service'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, settings, customPrompt, setAsActive, contextType } = body || {}

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }


    // Derive legacy fields for back-compat
    const backgroundUrl = settings?.background?.key ? `/api/files/get?key=${encodeURIComponent(settings.background.key)}` : null
    const backgroundPrompt = settings?.background?.prompt || null
    const logoUrl = settings?.branding?.logoKey ? `/api/files/get?key=${encodeURIComponent(settings.branding.logoKey)}` : null
    const stylePreset = settings?.style?.preset || 'corporate'

    // Get user's team (if any)
    // First try to find the user without includes
    let user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })
    
    // If not found by ID, try by email (fallback for session/database ID mismatches)
    if (!user) {
      user = await prisma.user.findUnique({
        where: { email: session.user.email }
      })
    }
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    // Block context creation for free plan users
    const planTier = (user as { planTier?: string | null }).planTier ?? null
    if (!planTier || planTier === 'free') {
      return NextResponse.json({ error: 'Style creation is not available on the free plan' }, { status: 403 })
    }

    
    // Now get the full user with includes using the actual user ID
    user = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        person: {
          include: {
            team: true
          }
        }
      }
    })

    // Determine if user is part of a team
    const teamId = (user as { person?: { team?: { id: string } } })?.person?.team?.id || null

    // Determine context type based on explicit parameter or fallback to user's team status
    const scope = (contextType === 'personal' || (!contextType && !teamId)) ? 'individual' as const : 'pro' as const

    const created = await createOrUpdateStyleServer({
      scope,
      userId: session.user.id,
      stylePreset,
      settings: { ...settings, backgroundUrl, backgroundPrompt, logoUrl, customPrompt },
      name
    })

    if (setAsActive) {
      await setActiveStyleServer({ scope, userId: session.user.id, styleId: created.id })
    }

    return NextResponse.json({ success: true, context: { id: created.id }, contextType: scope === 'pro' ? 'team' : 'personal' })

  } catch (error) {
    Logger.error('Error creating context', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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

    if (teamId) {
      // User is part of a team - return team contexts and show team type
      const teamData = (user as { person?: { team?: { contexts: unknown[]; activeContext: unknown } } })?.person?.team
      const teamContexts = (teamData as { contexts: unknown[] }).contexts || []
      const teamActive = (teamData as { activeContext: unknown }).activeContext || null

      return NextResponse.json({
        contexts: teamContexts,
        activeContext: teamActive,
        contextType: 'team'
      })
    } else {
      // Individual user - return personal contexts and show personal type
      const individualContexts = await prisma.context.findMany({
        where: { userId: session.user.id },
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
    }

  } catch (error) {
    Logger.error('Error fetching contexts', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}