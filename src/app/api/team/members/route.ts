import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withTeamPermission } from '@/domain/access/permissions'
import { Logger } from '@/lib/logger'
import { getTeamSeatInfo } from '@/domain/pricing/seats'

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
      .filter((id: string | undefined): id is string => Boolean(id))
    
    // Add revoked person IDs to the list for credit/generation queries
    revokedPersonIds.forEach((id: string) => {
      if (!allPersonIds.includes(id)) {
        allPersonIds.push(id)
      }
    })

    // OPTIMIZATION: Run all independent queries in parallel
    // Note: Credits are stored under personId (Person is the business entity)
    const [
      allGenerations,
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
      // Fetch all credit transactions for persons (credits stored under personId)
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
    const personCreditsAllocatedMap = new Map<string, number>()
    const personCreditsUsedMap = new Map<string, number>()

    teamInvitesMap.forEach((invite: TeamInvite, personId: string) => {
      // If person has invite, calculate remaining allocation from person transactions
      // Get generation and refund transactions for this person
      const personUsageTransactions = personCreditTransactions.filter((tx: PersonCreditTransaction) =>
        tx.personId === personId && (tx.type === 'generation' || tx.type === 'refund')
      )
      // Net usage: generations (negative) + refunds (positive) = net credits used
      const usedCredits = personUsageTransactions.reduce((sum: number, tx: PersonCreditTransaction) => {
        return tx.type === 'generation' ? sum + Math.abs(tx.credits) : sum - tx.credits
      }, 0)
      const remaining = Math.max(0, (invite.creditsAllocated ?? 0) - usedCredits)
      personCreditsMap.set(personId, remaining)
      personCreditsAllocatedMap.set(personId, invite.creditsAllocated ?? 0)
      personCreditsUsedMap.set(personId, Math.max(0, usedCredits))
    })

    // For persons without invites (e.g., admin with direct allocation), calculate from transactions
    personCreditTransactions.forEach((tx: PersonCreditTransaction) => {
      if (tx.personId && !teamInvitesMap.has(tx.personId)) {
        // Calculate allocated credits (all positive credit additions: purchase, seat_purchase, invite_allocated, free_grant, etc.)
        const isAllocation = tx.credits > 0 && !['generation', 'refund'].includes(tx.type)
        if (isAllocation) {
          personCreditsAllocatedMap.set(tx.personId, (personCreditsAllocatedMap.get(tx.personId) || 0) + tx.credits)
        }
        // Calculate net used credits (generations minus refunds)
        // Allow negative temporarily to handle refunds that come before generations in array
        if (tx.type === 'generation') {
          personCreditsUsedMap.set(tx.personId, (personCreditsUsedMap.get(tx.personId) || 0) + Math.abs(tx.credits))
        }
        if (tx.type === 'refund') {
          personCreditsUsedMap.set(tx.personId, (personCreditsUsedMap.get(tx.personId) || 0) - tx.credits)
        }
        // Calculate remaining (sum of all transactions)
        personCreditsMap.set(tx.personId, (personCreditsMap.get(tx.personId) || 0) + tx.credits)
      }
    })

    // Get seat info early to determine if we should filter admin
    const seatInfo = await getTeamSeatInfo(team.id)
    const isSeatsModel = seatInfo?.isSeatsModel || false

    // For seats-based teams, check if admin has self-assigned
    const adminPersonId = user.person?.id || ''
    const adminHasSelfAssigned = adminPersonId && teamInvitesMap.has(adminPersonId)

    // Build response for all active team members
    // Credits are stored under personId (Person is the business entity)
    // For seats-based teams, exclude admin unless they have self-assigned a seat
    const usersWithCredits = team.teamMembers
      .filter((p: TeamMember) => {
        // For seats-based teams, exclude admin if they haven't self-assigned
        if (isSeatsModel && p.userId === team.adminId && !adminHasSelfAssigned) {
          return false
        }
        return true
      })
      .map((p: TeamMember) => {
        // All credits are stored under personId
        const personCredits = personCreditsMap.get(p.id) || 0
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
            individualCredits: personCredits, // Credits stored under personId
            teamCredits: personCredits, // Same - credits belong to person
            teamCreditsAllocated: personCreditsAllocatedMap.get(p.id) || 0,
            teamCreditsUsed: Math.max(0, personCreditsUsedMap.get(p.id) || 0)
          }
        }
      })

    // Add revoked members to the list
    // Credits are stored under personId (Person is the business entity)
    revokedInvites.forEach((invite: RevokedInvite) => {
      if (!invite.person) return

      const p = invite.person
      // All credits are stored under personId
      const personCredits = personCreditsMap.get(p.id) || 0
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
          individualCredits: personCredits,
          teamCredits: personCredits,
          teamCreditsAllocated: personCreditsAllocatedMap.get(p.id) || 0,
          teamCreditsUsed: Math.max(0, personCreditsUsedMap.get(p.id) || 0)
        }
      })
    })

    // Only include admin if they have self-assigned a seat (have a TeamInvite)
    // Note: adminPersonId and adminHasSelfAssigned are already defined above
    type UserWithCredits = typeof usersWithCredits[number];

    // Credits are stored under personId (Person is the business entity)
    if (!usersWithCredits.find((u: UserWithCredits) => u.id === adminPersonId) && adminHasSelfAssigned) {
      const adminCredits = personCreditsMap.get(adminPersonId) || 0
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
          teamCredits: adminCredits,
          teamCreditsAllocated: personCreditsAllocatedMap.get(adminPersonId) || 0,
          teamCreditsUsed: Math.max(0, personCreditsUsedMap.get(adminPersonId) || 0)
        }
      })
    }

    // seatInfo is already fetched above

    return NextResponse.json({ 
      users: usersWithCredits,
      seatInfo: seatInfo ? {
        totalSeats: seatInfo.totalSeats,
        activeSeats: seatInfo.activeSeats,
        availableSeats: seatInfo.availableSeats,
        isSeatsModel: seatInfo.isSeatsModel
      } : null
    })
  } catch (e) {
    Logger.error('[team/members] error', { error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json({ error: 'Failed to load members' }, { status: 500 })
  }
}

