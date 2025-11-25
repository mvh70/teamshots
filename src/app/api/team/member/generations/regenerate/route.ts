import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { RegenerationService } from '@/domain/generation'

/**
 * Team Member Regeneration Endpoint (Token-Based)
 * 
 * Allows invited team members to regenerate photos using a shareable token link.
 * Authentication via invite token, no session required.
 */
export async function POST(request: NextRequest) {
  try {
    // Extract and validate token
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    // Validate the token and get person data
    const invite = await prisma.teamInvite.findFirst({
      where: {
        token,
        usedAt: { not: null }
      }
    })

    if (!invite) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    // Find the person by email from the invite
    const person = await prisma.person.findFirst({
      where: {
        email: invite.email,
        teamId: invite.teamId
      }
    })

    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    }

    // Parse request body
    const body = await request.json()
    const { generationId } = body

    if (!generationId) {
      return NextResponse.json({ error: 'Generation ID is required' }, { status: 400 })
    }

    // Use RegenerationService to handle the regeneration
    const result = await RegenerationService.regenerate({
      sourceGenerationId: generationId,
      personId: person.id,
      userId: person.userId || undefined,
      creditSource: 'team'
    })

    Logger.info('Team regeneration completed', { 
      generationId: result.generation.id,
      jobId: result.jobId 
    })

    return NextResponse.json({
      success: true,
      generationId: result.generation.id,
      jobId: result.jobId
    })

  } catch (error) {
    Logger.error('Team regeneration error', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(
      { error: 'Failed to start regeneration' },
      { status: 500 }
    )
  }
}
