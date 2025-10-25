import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPersonCreditBalance, getUserCreditBalance } from '@/lib/credits'
import { withCompanyPermission } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    // Check permission to view company members
    const permissionCheck = await withCompanyPermission(
      request,
      'company.view'
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

    // Get user's company information
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        person: {
          include: {
            company: {
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

    if (!user?.person?.company) {
      // User is not part of a company, return just current user
      return NextResponse.json({ users: [{ id: session.user.id, name: session.user.name || session.user.email }] })
    }

    const company = user.person.company

    // Get credit balances for all team members
    const usersWithCredits = await Promise.all(
      company.teamMembers.map(async (p) => {
        let individualCredits = 0
        let companyCredits = 0
        
        if (p.userId) {
          // User has account, get their credit balance
          individualCredits = await getUserCreditBalance(p.userId)
        } else {
          // Person without account, get their credit balance
          companyCredits = await getPersonCreditBalance(p.id)
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
          id: p.userId || p.id,
          name: [p.firstName, p.lastName].filter(Boolean).join(' ') || p.email || 'Member',
          email: p.email,
          userId: p.userId,
          isAdmin: p.userId === company.adminId,
          isCurrentUser: p.userId === session.user.id,
          stats: {
            selfies: p._count.selfies,
            generations: activeGenerations,
            individualCredits,
            companyCredits
          }
        }
      })
    )

    // Ensure current admin is included
    if (!usersWithCredits.find(u => u.id === session.user.id)) {
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
        id: session.user.id, 
        name: session.user.name || 'Me',
        email: session.user.email,
        userId: session.user.id,
        isAdmin: true,
        isCurrentUser: true,
        stats: {
          selfies: currentUser?.person?._count.selfies || 0,
          generations: adminActiveGenerations,
          individualCredits: adminCredits,
          companyCredits: 0
        }
      })
    }

    return NextResponse.json({ users: usersWithCredits })
  } catch (e) {
     
    console.error('[company/members] error', e)
    return NextResponse.json({ error: 'Failed to load members' }, { status: 500 })
  }
}


