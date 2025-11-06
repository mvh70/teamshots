import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Logger } from '@/lib/logger'
import { Telemetry } from '@/lib/telemetry'
import { checkRateLimit } from '@/lib/rate-limit'
import { RATE_LIMITS } from '@/config/rate-limit-config'
import { PRICING_CONFIG } from '@/config/pricing'
import { getEffectiveTeamCreditBalance, getPersonCreditBalance, hasSufficientCredits, reserveCreditsForGeneration, getTeamCreditBalance } from '@/domain/credits/credits'
import { getPackageConfig } from '@/domain/style/packages'
import { Env } from '@/lib/env'

// Minimal validation schema aligned with /api/generations/create
const createSchema = z.object({
  selfieKey: z.string().min(1),
  contextId: z.string().optional(),
  styleSettings: z.record(z.string(), z.unknown()).optional(),
  prompt: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    // Rate limit per invite token
    const rlKey = `generation:invite:${token}`
    const rate = await checkRateLimit(rlKey, RATE_LIMITS.generation.limit, RATE_LIMITS.generation.window)
    if (!rate.success) {
      return NextResponse.json(
        { error: 'Generation rate limit exceeded. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rate.reset - Date.now()) / 1000)) } }
      )
    }

    // Validate invite token and person
    const invite = await prisma.teamInvite.findFirst({
      where: { token, usedAt: { not: null } },
      include: { person: { include: { team: true } } },
    })

    if (!invite || !invite.person || !invite.person.teamId) {
      return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 401 })
    }

    const body = await request.json()
    const { selfieKey, contextId, styleSettings, prompt } = createSchema.parse(body)

    // Enforce team credits for invite flow
    const teamId = invite.person.teamId

    // OPTIMIZATION: Run independent queries in parallel
    const [selfie, teamUser] = await Promise.all([
      // Find selfie by key for this person (only need userId, not full team - already have it from invite)
      prisma.selfie.findFirst({
        where: { key: selfieKey, personId: invite.person.id },
        select: {
          id: true,
          key: true,
          personId: true,
          person: {
            select: {
              userId: true
            }
          }
        },
      }),
      // Check team credits (invitees may have personal allocation tracked separately)
      prisma.user.findFirst({
        where: { person: { teamId } },
        select: { id: true },
      })
    ])

    if (!selfie) {
      return NextResponse.json({ error: 'Selfie not found' }, { status: 404 })
    }

    const hasTeamCredits = await hasSufficientCredits(
      null,
      teamUser?.id || null,
      PRICING_CONFIG.credits.perGeneration,
      teamId,
    )

    if (!hasTeamCredits) {
      const userIdForBalance = teamUser?.id ?? invite.person.team?.adminId ?? null
      // OPTIMIZATION: Run credit balance queries in parallel
      const [available, personAllocation] = await Promise.all([
        userIdForBalance
          ? getEffectiveTeamCreditBalance(userIdForBalance, teamId)
          : getTeamCreditBalance(teamId),
        getPersonCreditBalance(invite.person.id)
      ])
      return NextResponse.json(
        {
          error: 'Insufficient team credits',
          required: PRICING_CONFIG.credits.perGeneration,
          available,
          personAllocation,
          message: personAllocation > 0
            ? 'You have allocation remaining but the team has insufficient credits. Contact your team admin.'
            : 'The team has insufficient credits. Contact your team admin.',
        },
        { status: 402 }
      )
    }

    // Prepare style settings (serialize via package adapter if provided)
    const finalPackageId = (styleSettings?.['packageId'] as string) || PRICING_CONFIG.defaultSignupPackage
    const pkg = getPackageConfig(finalPackageId)
    const serializedStyleSettings = pkg.persistenceAdapter.serialize(
      (styleSettings || {}) as Record<string, unknown>
    )

    // Create generation
    const generation = await prisma.generation.create({
      data: {
        personId: selfie.personId,
        selfieId: selfie.id,
        contextId: contextId ?? invite.person.team?.activeContextId ?? null,
        uploadedPhotoKey: selfie.key,
        generatedPhotoKeys: [],
        generationType: 'team',
        creditSource: 'team',
        status: 'pending',
        creditsUsed: PRICING_CONFIG.credits.perGeneration,
        provider: 'gemini',
        maxRegenerations: 0, // default; backend business rules can adjust later if needed
        remainingRegenerations: 0,
        styleSettings: serializedStyleSettings as unknown as Parameters<typeof prisma.generation.create>[0]['data']['styleSettings'],
      },
    })

    // Reserve team credits and link to invite
    try {
      await reserveCreditsForGeneration(
        invite.person.id,
        null,
        PRICING_CONFIG.credits.perGeneration,
        `Reserved for generation ${generation.id}`,
        teamId,
        invite.id,
      )
    } catch (creditError) {
      await prisma.generation.delete({ where: { id: generation.id } })
      throw creditError
    }

    // Enqueue the generation job
    const { imageGenerationQueue } = await import('@/queue')
    const job = await imageGenerationQueue.add(
      'generate',
      {
        generationId: generation.id,
        personId: selfie.personId,
        userId: selfie.person.userId || undefined,
        selfieId: selfie.id,
        selfieS3Key: selfie.key,
        styleSettings: serializedStyleSettings,
        prompt,
        providerOptions: {
          model: Env.string('GEMINI_IMAGE_MODEL', 'gemini-2.5-flash-image'),
          numVariations: 4,
        },
        creditSource: 'team',
      },
      { priority: 1, jobId: `gen-${generation.id}` }
    )

    Telemetry.increment('generation.create.success')
    return NextResponse.json({ success: true, generationId: generation.id, jobId: job.id, status: 'queued' })
  } catch (error) {
    Logger.error('Invite generation create failed', { error: error instanceof Error ? error.message : String(error) })
    Telemetry.increment('generation.create.error')
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to process generation request' }, { status: 500 })
  }
}


