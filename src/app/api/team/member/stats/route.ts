import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { getTeamInviteRemainingCredits } from '@/domain/credits/credits'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    // Validate the token and get person data
    const invite = await prisma.teamInvite.findFirst({
      where: {
        token,
        usedAt: { not: null }
      },
      include: {
        team: {
          include: {
            admin: {
              select: {
                email: true,
                person: {
                  select: {
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          }
        },
        person: true
      }
    })

    if (!invite) {
      return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 401 })
    }

    if (!invite.person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    }

    const person = invite.person

    // Get stats for the person
    const [photosGenerated, selfiesCount, teamPhotosCount] = await Promise.all([
      // Total photos generated
      prisma.generation.count({
        where: {
          personId: person.id,
          status: 'completed'
        }
      }),
      
      // Selfies uploaded
      prisma.selfie.count({
        where: {
          personId: person.id
        }
      }),
      
      // Team photos generated (person.teamId is set for team members)
      prisma.generation.count({
        where: {
          personId: person.id,
          status: 'completed',
          person: {
            teamId: { not: null } // Team generations have person.teamId set
          }
        }
      })
    ])

    // Calculate remaining credits using the same logic as getPersonCreditBalance
    const creditsRemaining = await getTeamInviteRemainingCredits(invite.id)

    // Get admin name from person if available, otherwise use email
    const adminPerson = invite.team.admin?.person
    const adminName = adminPerson 
      ? `${adminPerson.firstName}${adminPerson.lastName ? ' ' + adminPerson.lastName : ''}`.trim()
      : null
    const adminEmail = invite.team.admin?.email || null

    const stats = {
      photosGenerated,
      creditsRemaining,
      selfiesUploaded: selfiesCount,
      teamPhotosGenerated: teamPhotosCount,
      adminName,
      adminEmail
    }

    return NextResponse.json({ stats })
  } catch (error) {
    Logger.error('Error fetching team member stats', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
