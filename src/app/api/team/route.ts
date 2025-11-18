import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { migrateProCreditsToTeam } from '@/domain/credits/credits'
import { createTeamVerificationRequest } from '@/domain/auth/team-verification'


export const runtime = 'nodejs'
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, website } = body

    Logger.info('Team creation request', { name, website: website || 'not provided', hasName: !!name, hasWebsite: !!website })

    if (!name) {
      Logger.warn('Team creation failed: name is required', { name, website })
      return NextResponse.json({ error: 'Team name is required' }, { status: 400 })
    }

    // Website is optional - team verification will happen later if provided

    // Find the user's person record
    const person = await prisma.person.findUnique({
      where: { userId: session.user.id }
    })

    if (!person) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    if (person.teamId) {
      Logger.warn('Team creation failed: user already part of a team', { userId: session.user.id, existingTeamId: person.teamId })
      return NextResponse.json({ error: 'User is already part of a team' }, { status: 400 })
    }

    // Create team - domain verification happens later if website is provided
    Logger.info('Creating team', { name, website: website || 'not provided', userId: session.user.id })

    let team;
    if (website) {
      // Website provided - do domain verification
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { email: true }
      })

      if (!user?.email) {
        return NextResponse.json({ error: 'User email not found' }, { status: 404 })
      }

      const teamResult = await createTeamVerificationRequest(user.email, website, session.user.id)
      Logger.info('Team verification result', { success: teamResult.success, teamId: teamResult.teamId, error: teamResult.error })

      if (!teamResult.teamId) {
        Logger.warn('Team creation failed: no teamId returned', { email: user.email, website, error: teamResult.error })
        return NextResponse.json({ error: teamResult.error || 'Failed to create team' }, { status: 400 })
      }

      // Team was created successfully, even if verification is required
      if (teamResult.error && teamResult.error !== 'Team email verification required') {
        Logger.warn('Team creation warning: verification required', { email: user.email, website, teamId: teamResult.teamId, error: teamResult.error })
        // For now, allow team creation even with verification required
      }

      team = await prisma.team.findUnique({
        where: { id: teamResult.teamId }
      })

      if (!team) {
        return NextResponse.json({ error: 'Team creation failed' }, { status: 500 })
      }

      // Update team name (createTeamVerificationRequest uses domain as name, but we want the custom name)
      await prisma.team.update({
        where: { id: team.id },
        data: { name }
      })
    } else {
      // No website provided - create team without verification
      Logger.info('Creating team without website verification')
      team = await prisma.team.create({
        data: {
          name,
          adminId: session.user.id,
          teamMembers: {
            connect: {
              id: person.id
            }
          }
        }
      })
    }

    // Connect the person to the team
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

