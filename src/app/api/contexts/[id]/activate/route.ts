import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'

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

    // Get user's company (if any)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        person: {
          include: {
            company: true
          }
        }
      }
    })

    const companyId = user?.person?.company?.id || null

    // Enforce strict context type separation
    let context
    if (companyId) {
      // Company user - can only activate company contexts
      context = await prisma.context.findFirst({
        where: {
          id: id,
          companyId: companyId,
          userId: null // Company contexts don't have userId
        }
      })
      
      if (!context) {
        return NextResponse.json({ 
          error: 'Company context not found. Company users can only activate company contexts.' 
        }, { status: 404 })
      }
    } else {
      // Individual user - can only activate personal contexts
      context = await prisma.context.findFirst({
        where: {
          id: id,
          userId: session.user.id,
          companyId: null // Personal contexts don't have companyId
        }
      })
      
      if (!context) {
        return NextResponse.json({ 
          error: 'Personal context not found. Individual users can only activate personal contexts.' 
        }, { status: 404 })
      }
    }

    // Set as active context
    if (companyId) {
      // For company users, update the company's active context
      await prisma.company.update({
        where: { id: companyId },
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