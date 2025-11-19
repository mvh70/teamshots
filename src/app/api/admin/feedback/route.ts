import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'

export const runtime = 'nodejs'

/**
 * GET /api/admin/feedback
 * List all feedback with pagination and filtering
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    // Check admin access
    if (!session?.user || !session.user.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const type = searchParams.get('type') // 'general' | 'generation'
    const rating = searchParams.get('rating') // 'up' | 'down'
    const resolved = searchParams.get('resolved') // 'true' | 'false'
    const context = searchParams.get('context') // 'landing' | 'dashboard' | 'generation'

    const skip = (page - 1) * limit

    // Build filter object
    const where: {
      type?: string
      rating?: string
      resolved?: boolean
      context?: string
    } = {}

    if (type && (type === 'general' || type === 'generation')) {
      where.type = type
    }
    if (rating && (rating === 'up' || rating === 'down')) {
      where.rating = rating
    }
    if (resolved === 'true') {
      where.resolved = true
    } else if (resolved === 'false') {
      where.resolved = false
    }
    if (context && ['landing', 'dashboard', 'generation'].includes(context)) {
      where.context = context
    }

    // Fetch feedback with relations
    const [feedback, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        include: {
          person: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          generation: {
            select: {
              id: true,
              status: true,
              createdAt: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.feedback.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        feedback: feedback.map((f: typeof feedback[0]) => ({
          id: f.id,
          type: f.type,
          rating: f.rating,
          comment: f.comment,
          context: f.context,
          options: f.options,
          resolved: f.resolved,
          resolvedAt: f.resolvedAt,
          createdAt: f.createdAt,
          updatedAt: f.updatedAt,
          user: f.person
            ? {
                id: f.person.id,
                email: f.person.email,
              }
            : null,
          email: f.email,
          generation: f.generation
            ? {
                id: f.generation.id,
                status: f.generation.status,
                createdAt: f.generation.createdAt,
              }
            : null,
          generationId: f.generationId,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    Logger.error('Error fetching feedback', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: 'Failed to fetch feedback' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/feedback
 * Update feedback status (mark as resolved/unresolved)
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    
    // Check admin access
    if (!session?.user || !session.user.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { feedbackId, resolved } = body

    if (!feedbackId || typeof resolved !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid input. feedbackId and resolved (boolean) are required.' },
        { status: 400 }
      )
    }

    // Update feedback
    const feedback = await prisma.feedback.update({
      where: { id: feedbackId },
      data: {
        resolved,
        resolvedAt: resolved ? new Date() : null,
      },
    })

    Logger.info('Feedback status updated', {
      feedbackId,
      resolved,
      adminId: session.user.id,
    })

    return NextResponse.json({
      success: true,
      data: {
        id: feedback.id,
        resolved: feedback.resolved,
        resolvedAt: feedback.resolvedAt,
      },
    })
  } catch (error) {
    Logger.error('Error updating feedback', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: 'Failed to update feedback' },
      { status: 500 }
    )
  }
}

