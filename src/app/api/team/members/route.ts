import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPersonCreditBalance, getUserCreditBalance } from '@/domain/credits/credits'
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

    // Get current user's stats
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        person: {
          select: {
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

    // Get user's team information
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        person: {
          include: {
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

    // Get credit balances for all team members
    const usersWithCredits = await Promise.all(
      team.teamMembers.map(async (p) => {
        let individualCredits = 0
        let teamCredits = 0
        
        if (p.userId) {
          // User has account, get their credit balance
          individualCredits = await getUserCreditBalance(p.userId)
        } else {
          // Person without account, get their credit balance
          teamCredits = await getPersonCreditBalance(p.id)
        }

        // Get active generation count (excluding deleted and failed)
        const activeGenerations = await prisma.generation.count({
          where: {
            personId: p.id,
            deleted: false,
            status: {
              not: 'failed'
            }
          }
        })

        return {
          id: p.id, // Always return personId as id
          name: [p.firstName, p.lastName].filter(Boolean).join(' ') || p.email || 'Member',
          email: p.email,
          userId: p.userId,
          isAdmin: p.userId === team.adminId,
          isCurrentUser: p.userId === session.user.id,
          stats: {
            selfies: p._count.selfies,
            generations: activeGenerations,
            individualCredits,
            teamCredits
          }
        }
      })
    )

    // Ensure current admin is included
    if (!usersWithCredits.find(u => u.id === (user.person?.id || ''))) {
      const adminCredits = await getUserCreditBalance(session.user.id)
      
      // Get admin's active generation count (excluding deleted and failed)
      const adminActiveGenerations = await prisma.generation.count({
        where: {
          personId: user.person.id,
          deleted: false,
          status: {
            not: 'failed'
          }
        }
      })
      
      usersWithCredits.unshift({ 
        id: user.person?.id || session.user.id, // prefer personId
        name: session.user.name || 'Me',
        email: session.user.email,
        userId: session.user.id,
        isAdmin: true,
        isCurrentUser: true,
        stats: {
          selfies: currentUser?.person?._count.selfies || 0,
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

