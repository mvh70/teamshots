import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Logger } from '@/lib/logger'
import { Telemetry } from '@/lib/telemetry'
import { checkRateLimit } from '@/lib/rate-limit'
import { RATE_LIMITS } from '@/config/rate-limit-config'
import { PRICING_CONFIG, type PricingTier } from '@/config/pricing'
import { PACKAGES_CONFIG } from '@/config/packages'
import { getTeamInviteRemainingCredits } from '@/domain/credits/credits'
import { resolveSelfies } from '@/domain/generation/selfieResolver'
import { getRegenerationCount } from '@/domain/pricing'
import { CreditService } from '@/domain/services/CreditService'
import { UserService } from '@/domain/services/UserService'
import {
  enqueueGenerationJob,
  determineWorkflowVersion,
  createGenerationRecord,
  serializeStyleSettingsForGeneration,
  enrichGenerationJobFromSelfies,
} from '@/domain/generation/generation-helpers'
import { extendInviteExpiry } from '@/lib/invite-utils'

// Minimal validation schema aligned with /api/generations/create (now supports arrays)
const createSchema = z.object({
  selfieKeys: z.array(z.string()).optional(),
  selfieIds: z.array(z.string()).optional(),
  contextId: z.string().optional(),
  styleSettings: z.record(z.string(), z.unknown()).optional(),
  prompt: z.string().min(1),
  workflowVersion: z.enum(['v3']).optional(), // Workflow version: v3 (4-step). Defaults to 'v3'
  debugMode: z.boolean().optional().default(false), // Enable debug mode
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

    // Extend invite expiry (sliding expiration) - don't await to avoid blocking
    extendInviteExpiry(invite.id).catch(() => {
      // Silently fail - expiry extension is best effort
    })

    const body = await request.json()
    const { selfieKeys, selfieIds, contextId, styleSettings, prompt, workflowVersion, debugMode } = createSchema.parse(body)
    
    // Determine workflow version
    const finalWorkflowVersion = determineWorkflowVersion(workflowVersion)

    // Check invite's remaining credits first (invited members have their own allocation)
    const inviteCreditsRemaining = await getTeamInviteRemainingCredits(invite.id)
    if (inviteCreditsRemaining < PRICING_CONFIG.credits.perGeneration) {
      return NextResponse.json(
        {
          error: 'Insufficient credits',
          required: PRICING_CONFIG.credits.perGeneration,
          available: inviteCreditsRemaining,
          message: 'You don\'t have enough credits to generate photos. Please contact your team admin to request more credits.',
        },
        { status: 402 }
      )
    }

    // Enforce team credits for invite flow
    const teamId = invite.person.teamId

    // OPTIMIZATION: Run independent queries in parallel
    const [resolved, teamUser] = await Promise.all([
      resolveSelfies({ personId: invite.person.id, selfieKeys, selfieIds }),
      // Check team credits (invitees may have personal allocation tracked separately)
      prisma.user.findFirst({
        where: { person: { teamId } },
        select: { id: true },
      })
    ])
    // Fallback: if only one resolved but multiple are selected for this person, merge them
    let selfieKeysForJob = resolved.selfieS3Keys
    if (!Array.isArray(selfieKeysForJob) || selfieKeysForJob.length <= 1) {
      try {
        const moreSelected = await prisma.selfie.findMany({
          where: { personId: invite.person.id, selected: true },
          select: { key: true }
        })
        type MoreSelected = typeof moreSelected[number];
        const unique = Array.from(new Set([...(selfieKeysForJob || []), ...moreSelected.map((s: MoreSelected) => s.key)]))
        if (unique.length > 1) selfieKeysForJob = unique
      } catch {}
    }

    // NEW CREDIT MODEL: Credits are tracked per person, not per team pool
    // The check at line 75 (getTeamInviteRemainingCredits) already validates the person has sufficient credits
    // No additional "team credits" validation needed - the person's balance IS their allocation
    const userContext = await UserService.getUserContext(teamUser?.id || invite.person.team?.adminId || '')

    // Prepare style settings (serialize via package adapter if provided)
    const finalPackageId = (styleSettings?.['packageId'] as string) || PACKAGES_CONFIG.defaultPlanPackage
    const serializedStyleSettings = serializeStyleSettingsForGeneration({
      packageId: finalPackageId,
      styleSettings: (styleSettings || {}) as Record<string, unknown>,
      selfieS3Keys: selfieKeysForJob,
    })

    // Create generation
    // Determine regeneration allowances for invited users - they get the same as their team admin's plan
    let invitedRegenerations: number = getRegenerationCount('individual') // Fallback - use individual as default

    if (invite.person.teamId) {
      // Fetch team admin's plan to determine regeneration count
      const team = await prisma.team.findUnique({
        where: { id: invite.person.teamId },
        select: {
          admin: {
            select: {
              planPeriod: true,
              planTier: true
            }
          }
        }
      })

      if (team?.admin) {
        const adminPlanPeriod = (team.admin as unknown as { planPeriod?: string | null })?.planPeriod
        const adminPlanTier = (team.admin as unknown as { planTier?: string | null })?.planTier

        // Determine team admin's PricingTier to get regeneration count
        let adminPricingTier: PricingTier = 'individual' // Default fallback
        if (adminPlanTier === 'individual' && adminPlanPeriod === 'large') {
          adminPricingTier = 'vip'
        } else if (adminPlanTier === 'pro' && adminPlanPeriod === 'seats') {
          // Seats-based pricing uses individual regeneration count
          adminPricingTier = 'individual'
        } else if (adminPlanTier === 'individual' || adminPlanTier === 'pro') {
          // Individual tier or pro tier default to individual
          adminPricingTier = 'individual'
        }

        invitedRegenerations = getRegenerationCount(adminPricingTier)
      }
    }

    const generation = await createGenerationRecord({
      personId: invite.person.id,
      styleSettings: serializedStyleSettings,
      creditSource: 'individual', // NEW MODEL: credits always belong to person
      creditsUsed: PRICING_CONFIG.credits.perGeneration,
      contextId: contextId ?? invite.person.team?.activeContextId ?? undefined,
      provider: 'gemini',
      maxRegenerations: invitedRegenerations,
      remainingRegenerations: invitedRegenerations,
    })

    // Reserve team credits using CreditService
    // Credits are tracked per person, not per invite
    try {
      const reservationResult = await CreditService.reserveCreditsForGeneration(
        teamUser?.id || invite.person.team?.adminId || '',
        invite.person.id,
        PRICING_CONFIG.credits.perGeneration,
        userContext
      )

      if (!reservationResult.success) {
        Logger.error('Credit reservation failed for team member', { error: reservationResult.error })
        try {
          await prisma.generation.delete({ where: { id: generation.id } })
        } catch (deleteError) {
          // Ignore if generation was already deleted or doesn't exist
          Logger.warn('Failed to delete generation after credit reservation failure', {
            generationId: generation.id,
            error: deleteError instanceof Error ? deleteError.message : String(deleteError)
          })
        }
        throw new Error(reservationResult.error || 'Credit reservation failed')
      }

      Logger.debug('Team member credits reserved successfully', {
        generationId: generation.id,
        transactionId: reservationResult.transactionId,
        creditsUsed: reservationResult.individualCreditsUsed
      })
    } catch (creditError) {
      try {
        await prisma.generation.delete({ where: { id: generation.id } })
      } catch (deleteError) {
        // Ignore if generation was already deleted or doesn't exist
        Logger.warn('Failed to delete generation after credit reservation failure', {
          generationId: generation.id,
          error: deleteError instanceof Error ? deleteError.message : String(deleteError)
        })
      }
      throw creditError
    }

    const enrichment = await enrichGenerationJobFromSelfies({
      generationId: generation.id,
      personId: invite.person.id,
      teamId: teamId ?? undefined,
      selfieS3Keys: selfieKeysForJob,
    })

    // Enqueue the generation job
    const job = await enqueueGenerationJob({
      generationId: generation.id,
      personId: invite.person.id,
      userId: teamUser?.id || undefined,
      teamId: teamId ?? undefined,
      selfieS3Keys: selfieKeysForJob,
      selfieAssetIds: enrichment.selfieAssetIds,
      selfieTypeMap: enrichment.selfieTypeMap,
      demographics: enrichment.demographics,
      prompt,
      workflowVersion: finalWorkflowVersion,
      debugMode,
      creditSource: 'individual', // NEW MODEL: credits always belong to person
      priority: 1,
    })

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
