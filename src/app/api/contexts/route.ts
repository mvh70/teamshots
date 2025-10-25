import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, settings, customPrompt, setAsActive } = body || {}

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }


    // Derive legacy fields for back-compat
    const backgroundUrl = settings?.background?.key ? `/api/files/get?key=${encodeURIComponent(settings.background.key)}` : null
    const backgroundPrompt = settings?.background?.prompt || null
    const logoUrl = settings?.branding?.logoKey ? `/api/files/get?key=${encodeURIComponent(settings.branding.logoKey)}` : null
    const stylePreset = settings?.style?.preset || 'corporate'

    // Get user's company (if any)
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
    
    // Now get the full user with includes using the actual user ID
    user = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        person: {
          include: {
            company: true
          }
        }
      }
    })

    // Determine if user is part of a company
    const companyId = (user as { person?: { company?: { id: string } } })?.person?.company?.id || null

    // Enforce context type separation: company users can only create company contexts
    if (companyId) {
      // User is part of a company - create company context only
      const context = await prisma.context.create({
        data: {
          name,
          companyId,
          userId: null, // Company contexts don't have userId
          backgroundUrl,
          backgroundPrompt,
          logoUrl,
          stylePreset,
          customPrompt,
          settings: settings || {}
        }
      })

      // Set as active if requested
      if (setAsActive) {
        await prisma.company.update({
          where: { id: companyId },
          data: { activeContextId: context.id }
        })
      }

      return NextResponse.json({
        success: true,
        context,
        contextType: 'company'
      })
    } else {
      // Individual user - create personal context only
      const context = await prisma.context.create({
        data: {
          name,
          companyId: null, // Personal contexts don't have companyId
          userId: session.user.id,
          backgroundUrl,
          backgroundPrompt,
          logoUrl,
          stylePreset,
          customPrompt,
          settings: settings || {}
        }
      })

      // Set as active if requested
      if (setAsActive) {
        const currentMetadata = (user as { metadata?: Record<string, unknown> }).metadata || {}
        const updatedMetadata = { ...currentMetadata, activeContextId: context.id }
        
        await prisma.user.update({
          where: { id: user!.id },
          data: { 
            metadata: updatedMetadata
          }
        })
      }

      return NextResponse.json({
        success: true,
        context,
        contextType: 'personal'
      })
    }

  } catch (error) {
    console.error('Error creating context:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's company information
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        person: {
          include: {
            company: {
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

    const companyId = (user as { person?: { company?: { id: string } } })?.person?.company?.id || null

    if (companyId) {
      // User is part of a company - return company contexts and show company type
      const companyData = (user as { person?: { company?: { contexts: unknown[]; activeContext: unknown } } })?.person?.company
      const companyContexts = (companyData as { contexts: unknown[] }).contexts || []
      const companyActive = (companyData as { activeContext: unknown }).activeContext || null

      return NextResponse.json({
        contexts: companyContexts,
        activeContext: companyActive,
        contextType: 'company'
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
    console.error('Error fetching contexts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
