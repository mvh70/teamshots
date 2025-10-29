import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'

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
        company: true
      }
    })

    if (!invite) {
      return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 401 })
    }

    // Find the person by email from the invite
    const person = await prisma.person.findFirst({
      where: {
        email: invite.email,
        companyId: invite.companyId
      }
    })

    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    }

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
      
      // Team photos generated
      prisma.generation.count({
        where: {
          personId: person.id,
          status: 'completed',
          generationType: 'company'
        }
      })
    ])

    // Calculate remaining credits
    const creditsUsed = await prisma.generation.aggregate({
      where: {
        personId: person.id,
        status: 'completed'
      },
      _sum: {
        creditsUsed: true
      }
    })

    const creditsRemaining = Math.max(0, invite.creditsAllocated - (creditsUsed._sum.creditsUsed || 0))

    const stats = {
      photosGenerated,
      creditsRemaining,
      selfiesUploaded: selfiesCount,
      teamPhotosGenerated: teamPhotosCount
    }

    return NextResponse.json({ stats })
  } catch (error) {
    Logger.error('Error fetching team member stats', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
