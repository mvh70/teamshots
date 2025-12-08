import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { OnboardingContext } from '@/lib/onborda/config'
import { UserService } from '@/domain/services/UserService'
import { isFreePlan, type PlanPeriod } from '@/domain/subscription/utils'
import type { Prisma } from '@prisma/client'
import { extendInviteExpiry } from '@/lib/invite-utils'

const isJsonObject = (value: unknown): value is Prisma.JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const cloneJsonObject = (value: unknown): Prisma.JsonObject =>
  isJsonObject(value) ? { ...value } : {}

// GET /api/onboarding/context - Get onboarding context for current user/person
// Supports invite flow: if token query param is provided, get context for invited person instead of logged-in user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    let personId: string | undefined
    let userContext: Awaited<ReturnType<typeof UserService.getUserContext>> | null = null
    let inviteData: Awaited<ReturnType<typeof prisma.teamInvite.findFirst>> | null = null

    // If token is provided, this is an invite flow - get person from invite
    if (token) {
      inviteData = await prisma.teamInvite.findFirst({
        where: {
          token,
          usedAt: { not: null }
        },
        include: {
          person: {
            include: {
              team: true
            }
          },
          team: true
        }
      })

      if (!inviteData || !('person' in inviteData) || !inviteData.person) {
        return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 401 })
      }

      // Extend invite expiry (sliding expiration) - don't await to avoid blocking
      extendInviteExpiry(inviteData.id).catch(() => {
        // Silently fail - expiry extension is best effort
      })

      // TypeScript type narrowing: after the check above, we know inviteData.person exists and has an id
      const person = inviteData.person as { id: string }
      personId = person.id
    } else {
      // Normal flow: use logged-in session
      const session = await auth()

      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // OPTIMIZATION: Use shared UserService.getUserContext to get all user data in one call
      userContext = await UserService.getUserContext(session.user.id)
      personId = userContext.user.person?.id
    }

    // Load completed and pending tours from Person.onboardingState
    let completedTours: string[] = []
    let pendingTours: string[] = []
  let hiddenScreens: string[] = []
    if (personId) {
      const person = await prisma.person.findUnique({
        where: { id: personId },
        select: { onboardingState: true },
      })

      if (person?.onboardingState) {
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
        } catch {
          // If parsing fails, treat as empty (old format or invalid JSON)
        }
      }
    }

    // Determine onboarding segment based on user roles
    const determineSegment = (roles: { isTeamAdmin: boolean; isTeamMember: boolean }): 'organizer' | 'individual' | 'invited' => {
      if (roles.isTeamAdmin) return 'organizer'
      if (roles.isTeamMember) return 'invited'
      return 'individual'
    }

    // Normalize period from subscription.ts format to utils.ts format
    const normalizePeriod = (period: unknown): PlanPeriod | null => {
      if (period === 'free' || period === 'small' || period === 'large') {
        return period as PlanPeriod
      }
      // Map UIPlanTier values to PlanPeriod values
      if (period === 'proLarge') return 'large'
      if (period === 'individual' || period === 'proSmall') return 'small'
      // Legacy tryOnce/try_once periods are treated as free
      if (period === 'tryOnce' || period === 'try_once') return 'free'
      // Legacy subscription periods map to null (transactional pricing doesn't use monthly/annual)
      if (period === 'monthly' || period === 'annual') return null
      return null
    }

    // Build onboarding context
  let context: OnboardingContext & { completedTours?: string[]; pendingTours?: string[]; hiddenScreens?: string[] }
    
    if (token && personId && inviteData && 'person' in inviteData && inviteData.person) {
      // Invite flow: build context from invite and person data (already fetched above)
      // TypeScript type narrowing: after the check above, we know inviteData.person exists with proper structure
      const person = inviteData.person as {
        id: string
        userId: string | null
        firstName: string | null
        teamId: string | null
        team: { id: string; name: string | null } | null
      }
      
      // Get onboarding data from person's generations and selfies
      const [selfieCount, generationCount] = await Promise.all([
        prisma.selfie.count({ where: { personId: person.id } }),
        prisma.generation.count({ where: { personId: person.id, deleted: false } })
      ])

      context = {
        userId: person.userId || undefined,
        personId: person.id,
        firstName: person.firstName || undefined,
        isTeamAdmin: false,
        isTeamMember: true, // Invited users are team members
        isRegularUser: false,
        teamId: person.teamId || undefined,
        teamName: person.team?.name || undefined,
        hasUploadedSelfie: selfieCount > 0,
        hasGeneratedPhotos: generationCount > 0,
        accountMode: 'team_member' as const,
        language: 'en' as const,
        isFreePlan: true, // Invited users use team's plan
        onboardingSegment: 'invited' as const,
        _loaded: true,
        completedTours, // Include completed tours from database
        pendingTours, // Include pending tours from database
        hiddenScreens,
      }
    } else if (userContext) {
      // Normal flow: use userContext data
      context = {
        userId: userContext.user.id,
        personId: userContext.user.person?.id,
        firstName: userContext.user.person?.firstName,
        isTeamAdmin: userContext.roles.isTeamAdmin,
        isTeamMember: userContext.roles.isTeamMember,
        isRegularUser: userContext.roles.isRegularUser,
        teamId: userContext.teamId || undefined,
        teamName: userContext.user.person?.team?.name || undefined,
        hasUploadedSelfie: userContext.onboarding.hasUploadedSelfie,
        hasGeneratedPhotos: userContext.onboarding.hasGeneratedPhotos,
        accountMode: userContext.onboarding.accountMode,
        language: userContext.onboarding.language,
        isFreePlan: isFreePlan(normalizePeriod(userContext.subscription?.period)),
        onboardingSegment: determineSegment(userContext.roles),
        _loaded: true,
        completedTours, // Include completed tours from database
        pendingTours, // Include pending tours from database
        hiddenScreens,
      }
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json(context)

  } catch (error) {
    console.error('Error fetching onboarding context:', error)
    return NextResponse.json(
      { error: 'Failed to fetch onboarding context' },
      { status: 500 }
    )
  }
}

// POST /api/onboarding/context - Update onboarding context (progress tracking)
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    if (!isJsonObject(body) || !isJsonObject(body.updates)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const updates = body.updates

    // For now, we store progress in user metadata
    // This could be extended to store in a dedicated onboarding_progress table
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { metadata: true }
    })

    const currentMetadata = cloneJsonObject(currentUser?.metadata)
    const currentOnboarding = cloneJsonObject(currentMetadata.onboarding)

    const updatedMetadata: Prisma.JsonObject = {
      ...currentMetadata,
      onboarding: {
        ...currentOnboarding,
        ...updates,
        lastUpdated: new Date().toISOString()
      }
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { metadata: updatedMetadata }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error updating onboarding context:', error)
    return NextResponse.json(
      { error: 'Failed to update onboarding context' },
      { status: 500 }
    )
  }
}
