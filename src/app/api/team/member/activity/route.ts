import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { deriveGenerationType } from '@/domain/generation/utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    // Validate the token, check expiry, and get person data
    const invite = await prisma.teamInvite.findFirst({
      where: {
        token,
        usedAt: { not: null },
        expiresAt: { gt: new Date() }
      },
      include: {
        person: true
      }
    })

    if (!invite) {
      return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 401 })
    }

    // Verify person is still a member of the team
    if (invite.person && invite.person.teamId !== invite.teamId) {
      return NextResponse.json({ error: 'Access revoked' }, { status: 403 })
    }

    if (!invite.person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    }

    const person = invite.person

    // Get recent activity
    const generations = await prisma.generation.findMany({
      where: {
        personId: person.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10,
      include: {
        person: {
          select: {
            teamId: true // Needed to derive generationType
          }
        }
      }
    })

    type Generation = typeof generations[number];
    const activities = generations.map((generation: Generation) => {
      // Derive generationType from person.teamId (single source of truth)
      const derivedGenerationType = deriveGenerationType(generation.person.teamId)
      
      return {
        id: generation.id,
        type: 'generation',
        action: `Generated ${derivedGenerationType === 'personal' ? 'personal' : 'team'} photos`,
        time: generation.createdAt.toISOString(),
        status: generation.status,
        generationType: derivedGenerationType // Derived from person.teamId, not stored field
      }
    })

    return NextResponse.json({ activities })
  } catch (error) {
    Logger.error('Error fetching team member activity', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
