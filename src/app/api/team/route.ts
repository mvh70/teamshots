import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { migrateProCreditsToTeam } from '@/domain/credits/credits'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, website } = body

    if (!name) {
      return NextResponse.json({ error: 'Team name is required' }, { status: 400 })
    }

    // Find the user's person record
    const person = await prisma.person.findUnique({
      where: { userId: session.user.id }
    })

    if (!person) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }
    
    if (person.teamId) {
      return NextResponse.json({ error: 'User is already part of a team' }, { status: 400 })
    }

    // Create the team and connect the current user as the admin
    const team = await prisma.team.create({
      data: {
        name,
        website,
        adminId: session.user.id,
        teamMembers: {
          connect: {
            id: person.id
          }
        }
      },
    })

    // Also update the person record directly with the teamId
    await prisma.person.update({
      where: { id: person.id },
      data: { teamId: team.id }
    })

    // Migrate pro-tier credits from userId to teamId
    // This handles the case where user signed up with pro tier and got credits,
    // then later created a team - credits should move from personal to team
    try {
      const migratedCredits = await migrateProCreditsToTeam(session.user.id, team.id)
      if (migratedCredits > 0) {
        Logger.info('Migrated credits to team during team creation', {
          userId: session.user.id,
          teamId: team.id,
          credits: migratedCredits
        })
      }
    } catch (migrateError) {
      Logger.error('Failed to migrate credits to team', {
        error: migrateError instanceof Error ? migrateError.message : String(migrateError),
        userId: session.user.id,
        teamId: team.id
      })
      // Don't fail team creation if credit migration fails
    }

    return NextResponse.json({ success: true, teamId: team.id })
  } catch (error) {
    Logger.error('Error creating team', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

