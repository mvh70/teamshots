import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rate-limit'
import { RATE_LIMITS } from '@/config/rate-limit-config'
import { captureServerEvent } from '@/lib/analytics/server'
import { sendFeedbackNotificationEmail } from '@/lib/email/feedback-notification'
import { Logger } from '@/lib/logger'

export const runtime = 'nodejs'

const feedbackSchema = z.object({
  type: z.enum(['general', 'generation']),
  rating: z.enum(['up', 'down']),
  comment: z.string().optional(),
  context: z.enum(['landing', 'dashboard', 'generation']),
  category: z.enum(['bug', 'suggestion', 'question', 'other']).optional(), // For general feedback
  options: z.array(z.string()).optional(), // For generation feedback reasons
  generationId: z.string().optional(), // Required if type is 'generation'
  email: z.string().email().optional(), // Required if userId is not available (anonymous)
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)
    const body = await request.json()

    // Validate input
    const validated = feedbackSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validated.error.issues },
        { status: 400 }
      )
    }

    const { type, rating, comment, context, category, options, generationId, email } = validated.data

    // Get personId from session or token
    let personId: string | null = null
    let userEmail: string | null = email || session?.user?.email || null

    // Try to get personId from session user
    if (session?.user?.id) {
      const person = await prisma.person.findUnique({
        where: { userId: session.user.id },
        select: { id: true, email: true },
      })
      if (person) {
        personId = person.id
        userEmail = userEmail || person.email || null
      }
    }

    // If no personId from session, try token (for invite flows)
    const token = searchParams.get('token')
    if (!personId && token) {
      const invite = await prisma.teamInvite.findFirst({
        where: { token, usedAt: { not: null } },
        select: { personId: true, person: { select: { id: true, email: true } } },
      })
      if (invite?.person) {
        personId = invite.person.id
        userEmail = userEmail || invite.person.email || null
      }
    }

    // Validation: either personId OR email must be provided
    if (!personId && !userEmail) {
      return NextResponse.json(
        { error: 'Either user session, token, or email is required' },
        { status: 400 }
      )
    }

    // Validation: generationId required for generation feedback
    if (type === 'generation' && !generationId) {
      return NextResponse.json(
        { error: 'generationId is required for generation feedback' },
        { status: 400 }
      )
    }

    // Rate limiting
    const rateIdentifier = personId
      ? `feedback:person:${personId}`
      : `feedback:email:${userEmail}`
    
    const rateLimit = await checkRateLimit(
      rateIdentifier,
      RATE_LIMITS.feedback.limit,
      RATE_LIMITS.feedback.window
    )

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimit.reset - Date.now()) / 1000)),
          },
        }
      )
    }

    // Prepare options array (for generation feedback reasons or general category)
    let feedbackOptions: string[] | null = null
    if (type === 'generation' && options && options.length > 0) {
      feedbackOptions = options
    } else if (type === 'general' && category) {
      feedbackOptions = [category]
    }

    // Store or update feedback in database
    // For generation feedback, find existing feedback and update it, or create new
    // For general feedback, always create new entries
    let feedback
    if (type === 'generation' && generationId) {
      // Try to find existing feedback for this generation
      const existingFeedback = await prisma.feedback.findFirst({
        where: {
          generationId,
          type: 'generation',
          ...(personId ? { personId } : { email: userEmail }),
        },
      })

      if (existingFeedback) {
        // Update existing feedback
        feedback = await prisma.feedback.update({
          where: { id: existingFeedback.id },
          data: {
            rating,
            comment: comment || null,
            options: feedbackOptions || undefined,
          },
        })
      } else {
        // Create new feedback
        feedback = await prisma.feedback.create({
          data: {
            personId: personId || null,
            email: personId ? null : userEmail || null,
            generationId,
            type,
            rating,
            comment: comment || null,
            context,
            options: feedbackOptions || undefined,
          },
        })
      }
    } else {
      // General feedback - always create new
      feedback = await prisma.feedback.create({
        data: {
          personId: personId || null,
          email: personId ? null : userEmail || null,
          generationId: null,
          type,
          rating,
          comment: comment || null,
          context,
          options: feedbackOptions || undefined,
        },
      })
    }

    // Track analytics event
    const distinctId = personId || userEmail || 'anonymous'
    await captureServerEvent({
      event: 'feedback_submitted',
      distinctId,
      properties: {
        feedback_id: feedback.id,
        type,
        rating,
        context,
        has_comment: !!comment,
        has_options: !!feedbackOptions,
        generation_id: generationId || null,
      },
    })

    // Send email notification to support (especially for negative ratings)
    if (rating === 'down' || (rating === 'up' && comment)) {
      try {
        await sendFeedbackNotificationEmail({
          feedbackId: feedback.id,
          type,
          rating,
          comment: comment || null,
          context,
          category: category || null,
          options: feedbackOptions || null,
          userEmail: userEmail || null,
          personId: personId || null,
          generationId: generationId || null,
        })
      } catch (emailError) {
        // Log but don't fail the request if email fails
        Logger.error('Failed to send feedback notification email', {
          error: emailError instanceof Error ? emailError.message : String(emailError),
          feedbackId: feedback.id,
        })
      }
    }

    Logger.info('Feedback submitted', {
      feedbackId: feedback.id,
      type,
      rating,
      context,
      personId: personId || 'anonymous',
    })

    return NextResponse.json(
      {
        success: true,
        feedbackId: feedback.id,
      },
      { status: 201 }
    )
  } catch (error) {
    Logger.error('Feedback submission error', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: 'Failed to submit feedback. Please try again.' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/feedback?generationId=xxx&token=xxx (optional)
 * Get existing feedback for a generation (for the current user or token-based user)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)
    const generationId = searchParams.get('generationId')
    const token = searchParams.get('token')

    if (!generationId) {
      return NextResponse.json(
        { error: 'generationId is required' },
        { status: 400 }
      )
    }

    // Determine personId: from session user, or token-based person
    let personId: string | null = null

    // Try to get personId from session user
    if (session?.user?.id) {
      const person = await prisma.person.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      })
      if (person) {
        personId = person.id
      }
    }

    // If no personId from session, try token (for invite flows)
    if (!personId && token) {
      try {
        const invite = await prisma.teamInvite.findFirst({
          where: {
            token,
            usedAt: { not: null },
          },
          select: {
            personId: true,
          },
        })

        if (invite?.personId) {
          personId = invite.personId
        }
      } catch (error) {
        Logger.error('Failed to validate token for feedback lookup', {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // Build where clause for feedback lookup
    const whereClause: {
      generationId: string
      type: string
      personId?: string | null
      email?: string | null
    } = {
      generationId,
      type: 'generation',
    }

    // Add person identification if available
    if (personId) {
      whereClause.personId = personId
    } else {
      // No way to identify person, return null
      return NextResponse.json({ feedback: null })
    }

    const feedback = await prisma.feedback.findFirst({
      where: whereClause,
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (!feedback) {
      return NextResponse.json({ feedback: null })
    }

    return NextResponse.json({
      feedback: {
        id: feedback.id,
        rating: feedback.rating,
        comment: feedback.comment,
        options: feedback.options,
        createdAt: feedback.createdAt,
      },
    })
  } catch (error) {
    Logger.error('Failed to fetch feedback', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: 'Failed to fetch feedback' },
      { status: 500 }
    )
  }
}

