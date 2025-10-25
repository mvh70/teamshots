import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const personId = searchParams.get('personId')
    const token = searchParams.get('token')

    if (!personId || !token) {
      return NextResponse.json({ error: 'Missing personId or token' }, { status: 400 })
    }

    // Validate the token and get person data
    const invite = await prisma.teamInvite.findFirst({
      where: {
        token,
        usedAt: { not: null }
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
        selfie: true
      }
    })

    const activities = generations.map(generation => ({
      id: generation.id,
      type: 'generation',
      action: `Generated ${generation.generationType === 'personal' ? 'personal' : 'team'} photos`,
      time: generation.createdAt.toISOString(),
      status: generation.status,
      generationType: generation.generationType
    }))

    return NextResponse.json({ activities })
  } catch (error) {
    console.error('Error fetching team member activity:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
