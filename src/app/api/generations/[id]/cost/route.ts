/**
 * Generation Cost API
 *
 * Returns the cost breakdown for a specific generation.
 * Calculated dynamically from GenerationCost records (single source of truth).
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { Logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { CostTrackingService } from '@/domain/services/CostTrackingService'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { id: generationId } = await params

    // Get the generation to check ownership
    const generation = await prisma.generation.findUnique({
      where: { id: generationId },
      select: {
        id: true,
        personId: true,
        person: {
          select: {
            id: true,
            userId: true,
            teamId: true,
          },
        },
      },
    })

    if (!generation) {
      return NextResponse.json(
        { error: 'Generation not found' },
        { status: 404 }
      )
    }

    // Check if user has access to this generation
    const isAdmin = (session.user as { isAdmin?: boolean }).isAdmin ?? false
    const person = await prisma.person.findUnique({
      where: { userId: session.user.id },
      select: { id: true, teamId: true },
    })

    const hasAccess =
      isAdmin ||
      generation.person.userId === session.user.id ||
      (person?.teamId && generation.person.teamId === person.teamId)

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Get cost breakdown from CostTrackingService (single source of truth)
    const costData = await CostTrackingService.getGenerationTotal(generationId)

    return NextResponse.json({
      generationId,
      ...costData,
    })
  } catch (error) {
    Logger.error('Failed to get generation cost', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: 'Failed to get generation cost' },
      { status: 500 }
    )
  }
}
