import { NextRequest, NextResponse } from 'next/server'
import { prisma, Prisma } from '@/lib/prisma'
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
import { UserService } from '@/domain/services/UserService'
import { SecurityLogger } from '@/lib/security-logger'
import {
  enqueueGenerationJob,
  determineWorkflowVersion,
  createGenerationWithCreditReservation,
  serializeStyleSettingsForGeneration,
  enrichGenerationJobFromSelfies,
} from '@/domain/generation/generation-helpers'
import { resolveInviteAccess } from '@/lib/invite-access'
import {
  findDisallowedStyleCategory,
  hasPackageAccess,
  resolveGenerationContextSettings,
  resolveGenerationStyleSettings,
} from '@/domain/generation/create-validation'

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
    const inviteAccess = await resolveInviteAccess({ token })
    if (!inviteAccess.ok) {
      return NextResponse.json({ error: inviteAccess.error.message }, { status: inviteAccess.error.status })
    }

    // Rate limit per invite token
    const rlKey = `generation:invite:${inviteAccess.access.token}`
    const rate = await checkRateLimit(rlKey, RATE_LIMITS.generation.limit, RATE_LIMITS.generation.window)
    if (!rate.success) {
      return NextResponse.json(
        { error: 'Generation rate limit exceeded. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rate.reset - Date.now()) / 1000)) } }
      )
    }

    const invite = inviteAccess.access

    const body = await request.json()
    const { selfieKeys, selfieIds, contextId, styleSettings, prompt, workflowVersion, debugMode } = createSchema.parse(body)

    // Determine workflow version
    const finalWorkflowVersion = determineWorkflowVersion(workflowVersion)

    // Check invite's remaining credits first (invited members have their own allocation)
    const inviteCreditsRemaining = await getTeamInviteRemainingCredits(invite.inviteId)
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

    const [resolved, team] = await Promise.all([
      resolveSelfies({ personId: invite.person.id, selfieKeys, selfieIds }),
      prisma.team.findUnique({
        where: { id: invite.teamId },
        select: {
          adminId: true,
          activeContextId: true,
          admin: {
            select: {
              planPeriod: true,
              planTier: true,
            },
          },
        },
      }),
    ])

    if (!team?.adminId) {
      return NextResponse.json({ error: 'Team admin not found' }, { status: 404 })
    }

    const teamAdminId = team.adminId

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

    const userContext = await UserService.getUserContext(teamAdminId)

    const finalPackageId = (styleSettings?.['packageId'] as string) || PACKAGES_CONFIG.defaultPlanPackage
    const hasRequestedPackage = await hasPackageAccess(teamAdminId, finalPackageId)
    if (!hasRequestedPackage) {
      await SecurityLogger.logSuspiciousActivity(
        teamAdminId,
        'unauthorized_package_usage',
        { packageId: finalPackageId, inviteId: invite.inviteId, personId: invite.person.id, userIdChecked: teamAdminId }
      )
      return NextResponse.json(
        { error: 'You do not have access to this style package.' },
        { status: 403 }
      )
    }

    const typedStyleSettings = (styleSettings || {}) as Record<string, unknown>
    const disallowedCategory = findDisallowedStyleCategory(typedStyleSettings, finalPackageId)
    if (disallowedCategory) {
      Logger.warn('Attempted to set non-visible category in invite generation', {
        packageId: finalPackageId,
        category: disallowedCategory,
        inviteId: invite.inviteId,
        personId: invite.person.id,
      })
      return NextResponse.json(
        { error: `Category '${disallowedCategory}' is not allowed for package '${finalPackageId}'` },
        { status: 400 }
      )
    }

    const requestedContextId = contextId ?? invite.contextId ?? team.activeContextId ?? null
    const { resolvedContextId, contextStyleSettings } = await resolveGenerationContextSettings(requestedContextId)
    const resolvedStyleSettings = resolveGenerationStyleSettings({
      packageId: finalPackageId,
      contextStyleSettings,
      styleSettings: typedStyleSettings,
    })

    const serializedStyleSettings = serializeStyleSettingsForGeneration({
      packageId: finalPackageId,
      styleSettings: resolvedStyleSettings,
      selfieS3Keys: selfieKeysForJob,
    })

    // Create generation
    // Determine regeneration allowances for invited users - they get the same as their team admin's plan
    let invitedRegenerations: number = getRegenerationCount('individual') // Fallback - use individual as default

    if (team.admin) {
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

    const { generation } = await createGenerationWithCreditReservation({
      generationData: {
        personId: invite.person.id,
        generatedPhotoKeys: [],
        styleSettings: serializedStyleSettings as Prisma.InputJsonValue,
        creditSource: 'individual', // NEW MODEL: credits always belong to person
        creditsUsed: PRICING_CONFIG.credits.perGeneration,
        status: 'pending',
        contextId: resolvedContextId ?? undefined,
        provider: 'gemini',
        maxRegenerations: invitedRegenerations,
        remainingRegenerations: invitedRegenerations,
      },
      reservationUserId: teamAdminId,
      reservationPersonId: invite.person.id,
      requiredCredits: PRICING_CONFIG.credits.perGeneration,
      userContext,
    })

    const enrichment = await enrichGenerationJobFromSelfies({
      generationId: generation.id,
      personId: invite.person.id,
      teamId: invite.teamId,
      selfieS3Keys: selfieKeysForJob,
    })

    // Enqueue the generation job
    const job = await enqueueGenerationJob({
      generationId: generation.id,
      personId: invite.person.id,
      userId: invite.person.userId || teamAdminId,
      teamId: invite.teamId,
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
