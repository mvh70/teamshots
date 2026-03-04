import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { RegenerationService, NO_REGENERATIONS_REMAINING_ERROR } from '@/domain/generation'
import { resolveInviteAccess } from '@/lib/invite-access'

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
    const inviteAccess = await resolveInviteAccess({ token })
    if (!inviteAccess.ok) {
      return NextResponse.json({ error: inviteAccess.error.message }, { status: inviteAccess.error.status })
    }
    const person = inviteAccess.access.person

    // Parse request body
    const body = await request.json()
    const { generationId } = body

    if (!generationId) {
      return NextResponse.json({ error: 'Generation ID is required' }, { status: 400 })
    }

    const sourceGeneration = await prisma.generation.findFirst({
      where: {
        id: generationId,
        personId: person.id,
        deleted: false,
      },
      select: { id: true },
    })

    if (!sourceGeneration) {
      return NextResponse.json({ error: 'Generation not found' }, { status: 404 })
    }

    // Use RegenerationService to handle the regeneration
    const result = await RegenerationService.regenerate({
      sourceGenerationId: generationId,
      personId: person.id,
      userId: person.userId || undefined
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
    if (error instanceof Error && error.message === NO_REGENERATIONS_REMAINING_ERROR) {
      return NextResponse.json(
        { error: 'No regenerations remaining for this generation' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to start regeneration' },
      { status: 500 }
    )
  }
}
