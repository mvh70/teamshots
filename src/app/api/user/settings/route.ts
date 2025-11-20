import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'


export const runtime = 'nodejs'
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user with their team info
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        person: {
          include: {
            team: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Determine mode and team info
    // Check subscription tier to determine if user has pro features
    const subscription = await import('@/domain/subscription/subscription').then(m => m.getUserSubscription(user.id)).catch(() => null)
    const hasProTier = subscription?.tier === 'pro'
    const isTeamMember = !!user.person?.team
    
    const settings = {
      mode: (hasProTier || isTeamMember) ? 'pro' as const : 'individual' as const,
      teamName: user.person?.team?.name || undefined,
      teamWebsite: user.person?.team?.website || undefined,
      isAdmin: user.person?.team?.adminId === user.id
    }

    return NextResponse.json({ settings })

  } catch (error) {
    Logger.error('Error fetching user settings', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      const { mode, teamName, teamWebsite } = await request.json()

      if (!mode || !['individual', 'team', 'pro'].includes(mode)) {
        return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
      }
      
      // Map 'team' to 'pro' for consistency
      const effectiveMode = mode === 'team' ? 'pro' : mode

      // Get current user with their person record
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
          person: {
            include: {
              team: true
            }
          }
        }
      })

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      if (effectiveMode === 'pro') {
        // Switching to pro mode - create or update team
        if (!teamName) {
          return NextResponse.json({ error: 'Team name is required' }, { status: 400 })
        }

          let team

          if (user.person?.team) {
            // User already has a team, update it
            team = await prisma.team.update({
              where: { id: user.person.team.id },
              data: {
                name: teamName,
                website: teamWebsite || null
              }
            })

            // Ensure user role is team_admin if they're the admin
            // SECURITY: Incrementing tokenVersion invalidates all existing JWT tokens for this user
            if (team.adminId === user.id && user.role !== 'team_admin') {
              await prisma.user.update({
                where: { id: user.id },
                data: { 
                  role: 'team_admin',
                  tokenVersion: { increment: 1 } // Invalidate all existing sessions
                }
              })
            }

            // Migrate any remaining pro-tier credits (in case they weren't migrated before)
            try {
              const { migrateProCreditsToTeam } = await import('@/domain/credits/credits')
              await migrateProCreditsToTeam(user.id, team.id)
            } catch (migrateError) {
              Logger.error('Failed to migrate credits to existing team', {
                error: migrateError instanceof Error ? migrateError.message : String(migrateError),
                userId: user.id,
                teamId: team.id
              })
            }
          } else {
            // Create new team and link user as admin
            team = await prisma.team.create({
              data: {
                name: teamName,
                website: teamWebsite || null,
                adminId: user.id
              }
            })

            // Update user role to team_admin
            // SECURITY: Incrementing tokenVersion invalidates all existing JWT tokens for this user
            await prisma.user.update({
              where: { id: user.id },
              data: { 
                role: 'team_admin',
                tokenVersion: { increment: 1 } // Invalidate all existing sessions
              }
            })

            if (user.person) {
              // Link existing person to team
              await prisma.person.update({
                where: { id: user.person.id },
                data: { teamId: team.id }
              })
            } else {
              // Create new person record linked to team
              await prisma.person.create({
                data: {
                  firstName: session.user.name?.split(' ')[0] || 'User',
                  lastName: session.user.name?.split(' ').slice(1).join(' ') || null,
                  email: session.user.email!,
                  userId: user.id,
                  teamId: team.id,
                  onboardingState: JSON.stringify({
                    state: 'not_started',
                    completedTours: [],
                    pendingTours: [],
                    lastUpdated: new Date().toISOString(),
                  }),
                }
              })
            }

            // Migrate pro-tier credits from userId to teamId
            // This handles the case where user signed up with pro tier and got credits,
            // then later created a team - credits should move from personal to team
            try {
              const { migrateProCreditsToTeam } = await import('@/domain/credits/credits')
              const migratedCredits = await migrateProCreditsToTeam(user.id, team.id)
              if (migratedCredits > 0) {
                Logger.info('Migrated credits to team during team creation', {
                  userId: user.id,
                  teamId: team.id,
                  credits: migratedCredits
                })
              }
            } catch (migrateError) {
              Logger.error('Failed to migrate credits to team', {
                error: migrateError instanceof Error ? migrateError.message : String(migrateError),
                userId: user.id,
                teamId: team.id
              })
              // Don't fail team creation if credit migration fails
            }
          }

        return NextResponse.json({
          settings: {
            mode: 'pro' as const,
            teamName: team.name,
            teamWebsite: team.website,
            isAdmin: team.adminId === user.id
          }
        })

      } else {
        // Switching to individual mode - remove team association
        if (user.person?.team) {
          // If user is admin of a team with other members, prevent switching
          const teamWithMembers = await prisma.team.findFirst({
            where: { 
              id: user.person.team.id,
              adminId: user.id
            },
            include: {
              teamMembers: {
                where: {
                  id: { not: user.person.id }
                }
              }
            }
          })

          if (teamWithMembers && teamWithMembers.teamMembers.length > 0) {
            return NextResponse.json({ 
              error: 'Cannot switch to individual mode while you are admin of a team with other members. Please remove all team members first.' 
            }, { status: 400 })
          }

          // Remove team association
          await prisma.person.update({
            where: { id: user.person.id },
            data: { teamId: null }
          })

          // If this was the admin's team and it's now empty, delete the team
          if (teamWithMembers?.adminId === user.id) {
            await prisma.team.delete({
              where: { id: user.person.team.id }
            })
          }
        }

        return NextResponse.json({
          settings: {
            mode: 'individual' as const,
            isAdmin: false
          }
        })
      }

    } catch {
      return NextResponse.json({ error: 'Invalid JSON input' }, { status: 400 })
    }

  } catch (error) {
    Logger.error('Error updating user settings', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
