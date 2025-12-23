import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withTeamPermission } from '@/domain/access/permissions'
import { Logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    // Check permission to view team members
    const permissionCheck = await withTeamPermission(
      request,
      'team.view'
    )
    
    if (permissionCheck instanceof NextResponse) {
      return permissionCheck // Return error response
    }
    
    const { session } = permissionCheck

    // OPTIMIZATION: Single query to get user with all needed data (combines previous two queries)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        person: {
          select: {
            id: true,
            _count: {
              select: {
                selfies: true,
                generations: true
              }
            },
            team: {
              select: {
                id: true,
                adminId: true,
                teamMembers: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    userId: true,
                    email: true,
                    _count: {
                      select: {
                        selfies: true,
                        generations: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!user?.person?.team) {
      // User is not part of a team, return just current user (use personId when available)
      return NextResponse.json({ users: [{ id: user?.person?.id || session.user.id, name: session.user.name || session.user.email, userId: session.user.id }] })
    }

    const team = user.person.team
    type TeamMember = typeof team.teamMembers[number];
    const allPersonIds = team.teamMembers.map((p: TeamMember) => p.id)
    // Include current user's personId if not in team members
    if (user.person.id && !allPersonIds.includes(user.person.id)) {
      allPersonIds.push(user.person.id)
    }

    // Fetch revoked members (persons with teamId=null but have used invites for this team)
    const revokedInvites = await prisma.teamInvite.findMany({
      where: {
        teamId: team.id,
        usedAt: { not: null },
        person: {
          teamId: null // Revoked members
        }
      },
      include: {
        person: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            userId: true,
            email: true,
            _count: {
              select: {
                selfies: true,
                generations: true
              }
            }
          }
        }
      }
    })

    type RevokedInvite = typeof revokedInvites[number];
    const revokedPersonIds = revokedInvites
      .map((invite: RevokedInvite) => invite.person?.id)
      .filter((id): id is string => Boolean(id))
    
    // Add revoked person IDs to the list for credit/generation queries
    revokedPersonIds.forEach((id: string) => {
      if (!allPersonIds.includes(id)) {
        allPersonIds.push(id)
      }
    })

    // OPTIMIZATION: Batch fetch all credit transactions for all users and persons
    const userIds = team.teamMembers.filter((p: TeamMember) => p.userId).map((p: TeamMember) => p.userId as string)
    // Include current user's userId
    if (session.user.id && !userIds.includes(session.user.id)) {
      userIds.push(session.user.id)
    }

    // OPTIMIZATION: Run all independent queries in parallel
    const [
      allGenerations,
      userCreditTransactions,
      personCreditTransactions,
      teamInvites
    ] = await Promise.all([
      // Batch fetch all generation counts in a single query
      prisma.generation.findMany({
        where: {
          personId: { in: allPersonIds },
          deleted: false,
          status: { not: 'failed' }
        },
        select: {
          personId: true
        }
      }),
      // Fetch all credit transactions for users
      userIds.length > 0 ? prisma.creditTransaction.findMany({
        where: {
          userId: { in: userIds }
        },
        select: {
          userId: true,
          credits: true
        }
      }) : Promise.resolve([]),
      // Fetch all credit transactions for persons
      allPersonIds.length > 0 ? prisma.creditTransaction.findMany({
        where: {
          personId: { in: allPersonIds }
        },
        select: {
          personId: true,
          credits: true,
          type: true
        }
      }) : Promise.resolve([]),
      // Fetch all team invites for persons (needed for allocation amount)
      allPersonIds.length > 0 ? prisma.teamInvite.findMany({
        where: {
          personId: { in: allPersonIds }
        },
        select: {
          personId: true,
          creditsAllocated: true
        }
      }) : Promise.resolve([])
    ])

    // Count generations per personId in memory
    const generationCounts = new Map<string, number>()
    type Generation = typeof allGenerations[number];
    allGenerations.forEach((gen: Generation) => {
      generationCounts.set(gen.personId, (generationCounts.get(gen.personId) || 0) + 1)
    })

    // Create maps for quick lookup
    const userCreditsMap = new Map<string, number>()
    type UserCreditTransaction = typeof userCreditTransactions[number];
    userCreditTransactions.forEach((tx: UserCreditTransaction) => {
      if (tx.userId) {
        userCreditsMap.set(tx.userId, (userCreditsMap.get(tx.userId) || 0) + tx.credits)
      }
    })

    const teamInvitesMap = new Map<string, typeof teamInvites[0]>()
    type TeamInvite = typeof teamInvites[number];
    teamInvites.forEach((invite: TeamInvite) => {
      if (invite.personId) {
        teamInvitesMap.set(invite.personId, invite)
      }
    })

    // Calculate person credits (handling invite allocation logic)
    // Credits are tracked per person, so we look at person transactions, not invite transactions
    type PersonCreditTransaction = typeof personCreditTransactions[number];
    const personCreditsMap = new Map<string, number>()
    teamInvitesMap.forEach((invite, personId) => {
      // If person has invite, calculate remaining allocation from person transactions
      // Get generation transactions for this person
      const personGenTransactions = personCreditTransactions.filter((tx: PersonCreditTransaction) => 
        tx.personId === personId && tx.type === 'generation'
      )
      const usedCredits = personGenTransactions.reduce((sum, tx) => sum + Math.abs(tx.credits), 0)
      const remaining = Math.max(0, (invite.creditsAllocated ?? 0) - usedCredits)
      personCreditsMap.set(personId, remaining)
    })

    // For persons without invites, calculate from transactions
    personCreditTransactions.forEach((tx: PersonCreditTransaction) => {
      if (tx.personId && !personCreditsMap.has(tx.personId)) {
        personCreditsMap.set(tx.personId, (personCreditsMap.get(tx.personId) || 0) + tx.credits)
      }
    })

    // Build response for all active team members
    const usersWithCredits = team.teamMembers.map((p) => {
      let individualCredits = 0
      let teamCredits = 0
      
      if (p.userId) {
        // User has account, get their credit balance from map
        individualCredits = userCreditsMap.get(p.userId) || 0
      } else {
        // Person without account, get their credit balance from map
        teamCredits = personCreditsMap.get(p.id) || 0
      }

      const activeGenerations = generationCounts.get(p.id) || 0

      return {
        id: p.id, // Always return personId as id
        name: [p.firstName, p.lastName].filter(Boolean).join(' ') || p.email || 'Member',
        email: p.email,
        userId: p.userId,
        isAdmin: p.userId === team.adminId,
        isCurrentUser: p.userId === session.user.id,
        isRevoked: false,
        stats: {
          selfies: p._count.selfies,
          generations: activeGenerations,
          individualCredits,
          teamCredits
        }
      }
    })

    // Add revoked members to the list
    revokedInvites.forEach((invite) => {
      if (!invite.person) return
      
      const p = invite.person
      let individualCredits = 0
      let teamCredits = 0
      
      if (p.userId) {
        individualCredits = userCreditsMap.get(p.userId) || 0
      } else {
        teamCredits = personCreditsMap.get(p.id) || 0
      }

      const activeGenerations = generationCounts.get(p.id) || 0

      usersWithCredits.push({
        id: p.id,
        name: [p.firstName, p.lastName].filter(Boolean).join(' ') || p.email || 'Member',
        email: p.email,
        userId: p.userId,
        isAdmin: false, // Revoked members can't be admin
        isCurrentUser: p.userId === session.user.id,
        isRevoked: true,
        stats: {
          selfies: p._count.selfies,
          generations: activeGenerations,
          individualCredits,
          teamCredits
        }
      })
    })

    // Ensure current admin is included
    type UserWithCredits = typeof usersWithCredits[number];
    if (!usersWithCredits.find((u: UserWithCredits) => u.id === (user.person?.id || ''))) {
      const adminCredits = userCreditsMap.get(session.user.id) || 0
      const adminActiveGenerations = generationCounts.get(user.person.id) || 0
      
      usersWithCredits.unshift({ 
        id: user.person?.id || session.user.id, // prefer personId
        name: session.user.name || 'Me',
        email: session.user.email,
        userId: session.user.id,
        isAdmin: true,
        isCurrentUser: true,
        isRevoked: false,
        stats: {
          selfies: user.person?._count.selfies || 0,
          generations: adminActiveGenerations,
          individualCredits: adminCredits,
          teamCredits: 0
        }
      })
    }

    return NextResponse.json({ users: usersWithCredits })
  } catch (e) {
    Logger.error('[team/members] error', { error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json({ error: 'Failed to load members' }, { status: 500 })
  }
}

