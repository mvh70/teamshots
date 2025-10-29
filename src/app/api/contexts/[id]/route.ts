import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contextId } = await params
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find the context
    const context = await prisma.context.findFirst({
      where: {
        id: contextId,
        OR: [
          { userId: session.user.id }, // Personal context
          { 
            company: {
              teamMembers: {
                some: {
                  userId: session.user.id
                }
              }
            }
          } // Team context where user is a member
        ]
      },
      include: {
        company: {
          include: {
            teamMembers: {
              include: {
                user: true
              }
            }
          }
        }
      }
    })

    if (!context) {
      return NextResponse.json({ error: 'Context not found' }, { status: 404 })
    }

    return NextResponse.json({ context })
  } catch (error) {
    Logger.error('Error fetching context', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(
      { error: 'Failed to fetch context' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contextId } = await params
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, settings, customPrompt, setAsActive } = body

    // Find the context and verify ownership
    const context = await prisma.context.findFirst({
      where: {
        id: contextId,
        OR: [
          { userId: session.user.id }, // Personal context
          { 
            company: {
              teamMembers: {
                some: {
                  userId: session.user.id
                }
              }
            }
          } // Team context where user is a member
        ]
      },
      include: {
        company: true
      }
    })

    if (!context) {
      return NextResponse.json({ error: 'Context not found' }, { status: 404 })
    }

    // Derive legacy fields for back-compat
    const backgroundUrl = settings?.background?.key ? `/api/files/get?key=${encodeURIComponent(settings.background.key)}` : null
    const backgroundPrompt = settings?.background?.prompt || null
    const logoUrl = settings?.branding?.logoKey ? `/api/files/get?key=${encodeURIComponent(settings.branding.logoKey)}` : null
    const stylePreset = settings?.style?.preset || 'corporate'

    // Update the context
    const updatedContext = await prisma.context.update({
      where: { id: contextId },
      data: {
        name,
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
      if (context.companyId) {
        // Company context - update company's active context
        await prisma.company.update({
          where: { id: context.companyId },
          data: { activeContextId: contextId }
        })
      } else {
        // Personal context - update user's metadata
        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { metadata: true }
        })

        await prisma.user.update({
          where: { id: session.user.id },
          data: { 
            metadata: {
              ...((user?.metadata || {}) as Record<string, unknown>),
              activeContextId: contextId
            }
          }
        })
      }
    }

    return NextResponse.json({
      success: true,
      context: updatedContext
    })
  } catch (error) {
    Logger.error('Error updating context', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(
      { error: 'Failed to update context' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contextId } = await params
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find the context and verify ownership
    const context = await prisma.context.findFirst({
      where: {
        id: contextId,
        OR: [
          { userId: session.user.id }, // Personal context
          { 
            company: {
              teamMembers: {
                some: {
                  userId: session.user.id
                }
              }
            }
          } // Team context where user is a member
        ]
      },
      include: {
        company: true
      }
    })

    if (!context) {
      return NextResponse.json({ error: 'Context not found' }, { status: 404 })
    }

    // Check if this is the active context and handle accordingly
    if (context.companyId) {
      // Company context - check if it's the active context
      const company = await prisma.company.findUnique({
        where: { id: context.companyId },
        select: { activeContextId: true }
      })
      
      if (company?.activeContextId === contextId) {
        // Clear the active context
        await prisma.company.update({
          where: { id: context.companyId },
          data: { activeContextId: null }
        })
      }
    } else {
      // Personal context - check if it's the user's active context
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { metadata: true }
      })
      
      const userMetadata = (user?.metadata || {}) as Record<string, unknown>
      if (userMetadata?.activeContextId === contextId) {
        // Clear the active context
        await prisma.user.update({
          where: { id: session.user.id },
          data: { 
            metadata: {
              ...userMetadata,
              activeContextId: null
            }
          }
        })
      }
    }

    // Delete the context
    await prisma.context.delete({
      where: { id: contextId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    Logger.error('Error deleting context', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(
      { error: 'Failed to delete context' },
      { status: 500 }
    )
  }
}