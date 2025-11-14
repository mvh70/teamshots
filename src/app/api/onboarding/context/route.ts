import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { OnboardingContext } from '@/lib/onborda/config'
import { UserService } from '@/domain/services/UserService'
import { isFreePlan } from '@/domain/subscription/utils'
import type { Prisma } from '@prisma/client'

const isJsonObject = (value: unknown): value is Prisma.JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const cloneJsonObject = (value: unknown): Prisma.JsonObject =>
  isJsonObject(value) ? { ...value } : {}

// GET /api/onboarding/context - Get onboarding context for current user/person
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // OPTIMIZATION: Use shared UserService.getUserContext to get all user data in one call
    const userContext = await UserService.getUserContext(session.user.id)

    // Build onboarding context using pre-fetched data
    const context: OnboardingContext = {
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
      isFreePlan: isFreePlan(userContext.subscription?.period),
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
