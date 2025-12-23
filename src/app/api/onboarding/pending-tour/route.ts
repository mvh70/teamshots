import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// POST /api/onboarding/pending-tour - Add a tour to the pending list
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
    let hiddenScreens: string[] = []
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
        if (parsed.hiddenScreens && Array.isArray(parsed.hiddenScreens)) {
          hiddenScreens = parsed.hiddenScreens.filter((s: unknown): s is string => typeof s === 'string')
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

    // Don't add if tour is already completed or pending
    if (completedTours.includes(tourName) || pendingTours.includes(tourName)) {
      return NextResponse.json({
        success: true,
        message: 'Tour already in list',
        completedTours,
        pendingTours,
        state: overallState
      })
    }

    // Add the tour to pending tours
    pendingTours.push(tourName)

    // Update overall state if needed
    if (overallState === 'not_started' && (completedTours.length > 0 || pendingTours.length > 0)) {
      overallState = 'in_progress'
    }

    // Store as JSON string
    const updatedState = JSON.stringify({
      state: overallState,
      completedTours,
      pendingTours,
      hiddenScreens,
      lastUpdated: new Date().toISOString(),
    })

    // Update the person record
    await prisma.person.update({
      where: { id: person.id },
      data: { onboardingState: updatedState },
    })

    return NextResponse.json({
      success: true,
      completedTours,
      pendingTours,
      state: overallState
    })
  } catch (error) {
    console.error('Error adding pending tour:', error)
    return NextResponse.json(
      { error: 'Failed to add pending tour' },
      { status: 500 }
    )
  }
}

// DELETE /api/onboarding/pending-tour - Remove a tour from the pending list
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tourName = searchParams.get('tourName')

    if (!tourName) {
      return NextResponse.json({ error: 'Tour name required' }, { status: 400 })
    }

    // Find the person record for this user
    const person = await prisma.person.findUnique({
      where: { userId: session.user.id },
      select: { id: true, onboardingState: true },
    })

    if (!person) {
      return NextResponse.json({ error: 'Person record not found' }, { status: 404 })
    }

    // Parse existing onboarding state
    let completedTours: string[] = []
    let pendingTours: string[] = []
    let hiddenScreens: string[] = []
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
        if (parsed.hiddenScreens && Array.isArray(parsed.hiddenScreens)) {
          hiddenScreens = parsed.hiddenScreens.filter((s: unknown): s is string => typeof s === 'string')
        }
        if (parsed.state && ['not_started', 'in_progress', 'completed'].includes(parsed.state)) {
          overallState = parsed.state
        }
      } catch {
        // If parsing fails, treat as old format
        if (['not_started', 'in_progress', 'completed'].includes(person.onboardingState)) {
          overallState = person.onboardingState as 'not_started' | 'in_progress' | 'completed'
        }
      }
    }

    // Remove the tour from pending tours
    pendingTours = pendingTours.filter((tour: string) => tour !== tourName)

    // Store as JSON string
    const updatedState = JSON.stringify({
      state: overallState,
      completedTours,
      pendingTours,
      hiddenScreens,
      lastUpdated: new Date().toISOString(),
    })

    // Update the person record
    await prisma.person.update({
      where: { id: person.id },
      data: { onboardingState: updatedState },
    })

    return NextResponse.json({
      success: true,
      completedTours,
      pendingTours,
      state: overallState
    })
  } catch (error) {
    console.error('Error removing pending tour:', error)
    return NextResponse.json(
      { error: 'Failed to remove pending tour' },
      { status: 500 }
    )
  }
}
