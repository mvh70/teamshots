'use server'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const ALLOWED_SCREENS = ['selfie-tips', 'customization-intro'] as const
type AllowedScreen = (typeof ALLOWED_SCREENS)[number]

interface ParsedOnboardingState {
  state: 'not_started' | 'in_progress' | 'completed'
  completedTours: string[]
  pendingTours: string[]
  hiddenScreens: string[]
}

function parseOnboardingState(raw: string | null): ParsedOnboardingState {
  const defaults: ParsedOnboardingState = {
    state: 'not_started',
    completedTours: [],
    pendingTours: [],
    hiddenScreens: []
  }

  if (!raw) return defaults

  try {
    const parsed = JSON.parse(raw)
    return {
      state: ['not_started', 'in_progress', 'completed'].includes(parsed.state) ? parsed.state : defaults.state,
      completedTours: Array.isArray(parsed.completedTours) ? parsed.completedTours : defaults.completedTours,
      pendingTours: Array.isArray(parsed.pendingTours) ? parsed.pendingTours : defaults.pendingTours,
      hiddenScreens: Array.isArray(parsed.hiddenScreens)
        ? parsed.hiddenScreens.filter((s: unknown): s is string => typeof s === 'string')
        : defaults.hiddenScreens
    }
  } catch {
    // Legacy values were just the state string; preserve if possible
    if (['not_started', 'in_progress', 'completed'].includes(raw)) {
      return { ...defaults, state: raw as ParsedOnboardingState['state'] }
    }
    return defaults
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { screenName, token } = body as { screenName?: string; token?: string }

    if (!screenName || typeof screenName !== 'string') {
      return NextResponse.json({ error: 'Invalid screen name' }, { status: 400 })
    }

    const normalizedScreen = ALLOWED_SCREENS.includes(screenName as AllowedScreen)
      ? (screenName as AllowedScreen)
      : null

    if (!normalizedScreen) {
      return NextResponse.json({ error: 'Unsupported screen name' }, { status: 400 })
    }

    let person: { id: string; onboardingState: string | null } | null = null

    if (token) {
      const inviteData = await prisma.teamInvite.findFirst({
        where: { token, usedAt: { not: null } },
        include: {
          person: {
            select: {
              id: true,
              onboardingState: true
            }
          }
        }
      })

      if (!inviteData?.person) {
        return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 401 })
      }

      person = inviteData.person
    } else {
      const session = await auth()
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      person = await prisma.person.findUnique({
        where: { userId: session.user.id },
        select: { id: true, onboardingState: true }
      })

      if (!person) {
        return NextResponse.json({ error: 'Person record not found' }, { status: 404 })
      }
    }

    if (!person) {
      return NextResponse.json({ error: 'Person record not found' }, { status: 404 })
    }

    const parsed = parseOnboardingState(person.onboardingState)
    const updatedHiddenScreens = Array.from(new Set([...parsed.hiddenScreens, normalizedScreen]))

    const updatedState = JSON.stringify({
      state: parsed.state,
      completedTours: parsed.completedTours,
      pendingTours: parsed.pendingTours,
      hiddenScreens: updatedHiddenScreens,
      lastUpdated: new Date().toISOString()
    })

    await prisma.person.update({
      where: { id: person.id },
      data: { onboardingState: updatedState }
    })

    return NextResponse.json({ success: true, hiddenScreens: updatedHiddenScreens })
  } catch (error) {
    console.error('Error updating onboarding hidden screens:', error)
    return NextResponse.json({ error: 'Failed to update onboarding preferences' }, { status: 500 })
  }
}
