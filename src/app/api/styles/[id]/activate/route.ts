import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'


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

    // Get user's team (if any)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        person: {
          include: {
            team: true
          }
        }
      }
    })

    const teamId = user?.person?.team?.id || null

    // Enforce strict context type separation
    let context
    if (teamId) {
      // Team user - can only activate team contexts
      context = await prisma.context.findFirst({
        where: {
          id: id,
          teamId: teamId,
          userId: null // Team contexts don't have userId
        }
      })
      
      if (!context) {
        return NextResponse.json({ 
          error: 'Team context not found. Team users can only activate team contexts.' 
        }, { status: 404 })
      }
    } else {
      // Individual user - can only activate personal contexts
      context = await prisma.context.findFirst({
        where: {
          id: id,
          userId: session.user.id,
          teamId: null // Personal contexts don't have teamId
        }
      })
      
      if (!context) {
        return NextResponse.json({ 
          error: 'Personal context not found. Individual users can only activate personal contexts.' 
        }, { status: 404 })
      }
    }

    // Set as active context
    if (teamId) {
      // For team users, update the team's active context
      await prisma.team.update({
        where: { id: teamId },
        data: { activeContextId: context.id }
      })
    } else {
      // For individual users, store in user metadata
      // Use upsert to handle cases where metadata might not be initialized
      const existingUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { metadata: true }
      })
      
      if (!existingUser) {
        Logger.error('User not found for context activation', { userId: session.user.id })
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      
      // Merge with existing metadata or create new
      const currentMetadata = (existingUser.metadata as Record<string, unknown>) || {}
      const updatedMetadata = { ...currentMetadata, activeContextId: context.id }
      
      await prisma.user.update({
        where: { id: session.user.id },
        data: { 
          metadata: updatedMetadata
        }
      })
    }

    return NextResponse.json({
      success: true,
      context
    })

  } catch (error) {
    Logger.error('Error activating context', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}