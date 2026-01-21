import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { setActiveStyleServer } from '../_service'


export const runtime = 'nodejs'
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
            team: {
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
        team: {
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
            team: {
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
        team: true
      }
    })

    if (!context) {
      return NextResponse.json({ error: 'Context not found' }, { status: 404 })
    }

    // SECURITY: For team contexts, require admin role for modifications
    // This prevents team members from modifying shared team settings
    if (context.teamId && context.team?.adminId !== session.user.id) {
      return NextResponse.json(
        { error: 'Only team admin can modify team contexts' },
        { status: 403 }
      )
    }

    // Update style - store customPrompt in settings
    const updatedSettings = { ...settings, customPrompt }
    const updatedContext = await prisma.context.update({
      where: { id: contextId },
      data: { name, settings: updatedSettings }
    })

    if (typeof setAsActive === 'boolean') {
      await setActiveStyleServer({
        scope: context.teamId ? 'pro' : 'individual',
        userId: session.user.id,
        styleId: setAsActive ? contextId : null
      })
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
            team: {
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
        team: true
      }
    })

    if (!context) {
      return NextResponse.json({ error: 'Context not found' }, { status: 404 })
    }

    // SECURITY: For team contexts, require admin role for deletion
    // This prevents team members from deleting shared team contexts
    if (context.teamId && context.team?.adminId !== session.user.id) {
      return NextResponse.json(
        { error: 'Only team admin can delete team contexts' },
        { status: 403 }
      )
    }

    // Check if this is the active context and handle accordingly
    if (context.teamId) {
      // Team context - check if it's the active context
      const team = await prisma.team.findUnique({
        where: { id: context.teamId },
        select: { activeContextId: true }
      })
      
      if (team?.activeContextId === contextId) {
        // Clear the active context
        await prisma.team.update({
          where: { id: context.teamId },
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