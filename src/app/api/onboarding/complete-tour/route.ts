import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// POST /api/onboarding/complete-tour - Mark a tour as completed in Person.onboardingState
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { tourName } = body

    if (!tourName || typeof tourName !== 'string') {
      return NextResponse.json({ error: 'Invalid tour name' }, { status: 400 })
    }

    // Find the person record for this user
    const person = await prisma.person.findUnique({
      where: { userId: session.user.id },
      select: { id: true, onboardingState: true },
    })

    if (!person) {
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

