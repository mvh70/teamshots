import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { deriveGenerationType } from '@/domain/generation/utils'
import { resolveInviteAccess } from '@/lib/invite-access'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const inviteAccess = await resolveInviteAccess({ token })
    if (!inviteAccess.ok) {
      return NextResponse.json({ error: inviteAccess.error.message }, { status: inviteAccess.error.status })
    }
    const person = inviteAccess.access.person

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
