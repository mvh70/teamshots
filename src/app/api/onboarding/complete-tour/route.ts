import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// POST /api/onboarding/complete-tour - Mark a tour as completed in Person.onboardingState
// Supports invite flow: if token is provided in body, get person from invite instead of logged-in user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tourName, token } = body

    if (!tourName || typeof tourName !== 'string') {
      return NextResponse.json({ error: 'Invalid tour name' }, { status: 400 })
    }

    let personId: string | undefined
    let person: { id: string; onboardingState: string | null } | null = null

    // If token is provided, this is an invite flow - get person from invite
    if (token) {
      const inviteData = await prisma.teamInvite.findFirst({
        where: {
          token,
          usedAt: { not: null }
        },
        include: {
          person: {
            select: {
              id: true,
              onboardingState: true
            }
          }
        }
      })

      if (!inviteData || !('person' in inviteData) || !inviteData.person) {
        console.error(`[complete-tour API] Invalid invite token or person not found for token: ${token.substring(0, 8)}...`)
        return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 401 })
      }

      person = inviteData.person as { id: string; onboardingState: string | null }
      personId = person.id
    } else {
      // Normal flow: use logged-in session
      const session = await auth()

      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Find the person record for this user
      person = await prisma.person.findUnique({
        where: { userId: session.user.id },
        select: { id: true, onboardingState: true },
      })

      if (!person) {
        return NextResponse.json({ error: 'Person record not found' }, { status: 404 })
      }

      personId = person.id
    }

    if (!person || !personId) {
      return NextResponse.json({ error: 'Person record not found' }, { status: 404 })
    }

    // Parse existing onboarding state (stored as JSON string)
    let completedTours: string[] = []
    let pendingTours: string[] = []
    let overallState: 'not_started' | 'in_progress' | 'completed' = 'not_started'

    if (person.onboardingState) {
      try {
        const parsed = JSON.parse(person.onboardingState)
        if (parsed.completedTours && Array.isArray(parsed.completedTours)) {
          completedTours = parsed.completedTours
        }
        if (parsed.pendingTours && Array.isArray(parsed.pendingTours)) {
          pendingTours = parsed.pendingTours
        }
        if (parsed.state && ['not_started', 'in_progress', 'completed'].includes(parsed.state)) {
          overallState = parsed.state
        }
      } catch {
        // If parsing fails, treat as old format or empty
        // If it's one of the old state values, preserve it
        if (['not_started', 'in_progress', 'completed'].includes(person.onboardingState)) {
          overallState = person.onboardingState as 'not_started' | 'in_progress' | 'completed'
        }
      }
    }

    // Add the tour to completed tours if not already there
    if (!completedTours.includes(tourName)) {
      completedTours.push(tourName)
    }

    // Remove the tour from pending tours if it was pending
    pendingTours = pendingTours.filter(tour => tour !== tourName)

    // Update overall state based on tour completion
    if (overallState === 'not_started' && completedTours.length > 0) {
      overallState = 'in_progress'
    }

    // Store as JSON string: { state: "in_progress", completedTours: [...], pendingTours: [...] }
    const updatedState = JSON.stringify({
      state: overallState,
      completedTours,
      pendingTours,
      lastUpdated: new Date().toISOString(),
    })

    // Update the person record
    await prisma.person.update({
      where: { id: person.id },
      data: { onboardingState: updatedState },
    })

    return NextResponse.json({ success: true, completedTours, pendingTours, state: overallState })
  } catch (error) {
    console.error('Error completing tour:', error)
    return NextResponse.json(
      { error: 'Failed to complete tour' },
      { status: 500 }
    )
  }
}

