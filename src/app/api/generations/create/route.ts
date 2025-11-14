/**
 * Create Generation API Endpoint
 * 
 * Enqueues image generation jobs and handles credit validation
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

export const runtime = 'nodejs'
import { prisma } from '@/lib/prisma'
import { Env } from '@/lib/env'
import { getPersonCreditBalance } from '@/domain/credits/credits'
import { PRICING_CONFIG } from '@/config/pricing'
import { getRegenerationCount } from '@/domain/pricing'
import { checkRateLimit } from '@/lib/rate-limit'
import { RATE_LIMITS } from '@/config/rate-limit-config'
import { SecurityLogger } from '@/lib/security-logger'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { Logger } from '@/lib/logger'
import { Telemetry } from '@/lib/telemetry'
import { getPackageConfig } from '@/domain/style/packages'
import { CreditService } from '@/domain/services/CreditService'
import { UserService } from '@/domain/services/UserService'
import { deriveGenerationType, deriveCreditSource } from '@/domain/generation/utils'

const cloneDeep = <T>(value: T): T => JSON.parse(JSON.stringify(value))

// Generic deep merge that preserves user-choice nulls and ignores undefined
function deepMerge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = Array.isArray(base) ? [...base] as unknown as Record<string, unknown> : { ...base }
  for (const [k, v] of Object.entries(override)) {
    if (v === undefined) continue
    if (v === null) { out[k] = null; continue }
    const bv = out[k]
    if (bv && typeof bv === 'object' && !Array.isArray(bv) && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = deepMerge(bv as Record<string, unknown>, v as Record<string, unknown>)
    } else {
      out[k] = v
    }
  }
  return out
}

// Request validation schema
const createGenerationSchema = z.object({
  selfieId: z.string().optional(), // Database ID for selfie (single)
  selfieKey: z.string().optional(), // Alternative: S3 key for selfie (single)
  selfieIds: z.array(z.string()).optional(), // NEW: multiple selfies by ID
  selfieKeys: z.array(z.string()).optional(), // NEW: multiple selfies by S3 key
  contextId: z.string().optional(),
  styleSettings: z.object({
    packageId: z.string().optional(), // Package folder name (e.g., 'headshot1', 'freepackage')
    style: z.any().optional(), // Allow any type since it might be an object
    background: z.any().optional(),
    branding: z.any().optional(),
    clothing: z.any().optional(),
    clothingColors: z.any().optional(),
    shotType: z.any().optional(),
    expression: z.any().optional(),
    lighting: z.any().optional(),
  }).optional(),
  prompt: z.string().min(1, 'Prompt is required'),
  isRegeneration: z.boolean().optional().default(false), // Flag to indicate this is a regeneration
  originalGenerationId: z.string().optional(), // ID of the original generation being regenerated
})

export async function POST(request: NextRequest) {
  try {
    // Get user session
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Rate limiting per user
    const userIdentifier = `generation:user:${session.user.id}`
    const rateLimit = await checkRateLimit(userIdentifier, RATE_LIMITS.generation.limit, RATE_LIMITS.generation.window)

    if (!rateLimit.success) {
      await SecurityLogger.logRateLimitExceeded(userIdentifier)
      return NextResponse.json(
        { error: 'Generation rate limit exceeded. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.reset - Date.now()) / 1000)) }}
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = createGenerationSchema.parse(body)
    
    const { selfieId, selfieKey, selfieIds, selfieKeys, contextId, styleSettings, prompt, isRegeneration, originalGenerationId } = validatedData

    // Determine requested selfies (multiple preferred)
    const requestedIds = Array.isArray(selfieIds) ? selfieIds : (selfieId ? [selfieId] : [])
    const requestedKeys = Array.isArray(selfieKeys) ? selfieKeys : (selfieKey ? [selfieKey] : [])

    if (requestedIds.length === 0 && requestedKeys.length === 0) {
      return NextResponse.json(
        { error: 'At least one selfie is required' },
        { status: 400 }
      )
    }

    // OPTIMIZATION: Resolve selfies by IDs and keys in parallel
    const [foundByIds, foundByKeys] = await Promise.all([
      requestedIds.length > 0
        ? prisma.selfie.findMany({
            where: { id: { in: requestedIds } },
            include: { person: { select: { userId: true, teamId: true } } }
          })
        : Promise.resolve([]),
      requestedKeys.length > 0
        ? prisma.selfie.findMany({
            where: { key: { in: requestedKeys } },
            include: { person: { select: { userId: true, teamId: true } } }
          })
        : Promise.resolve([])
    ])

    // Combine results, avoiding duplicates
    const seenIds = new Set<string>()
    const selfies = [] as Array<{ id: string; key: string; personId: string; person: { userId: string | null; teamId: string | null } }>
    for (const s of [...foundByIds, ...foundByKeys]) {
      if (!seenIds.has(s.id)) {
        seenIds.add(s.id)
        selfies.push({
          id: s.id,
          key: s.key,
          personId: s.personId,
          person: { userId: s.person?.userId || null, teamId: s.person?.teamId || null }
        })
      }
    }

    if (selfies.length === 0) {
      return NextResponse.json({ error: 'Selfies not found' }, { status: 404 })
    }

    // Server-side fallback: if only one selfie resolved but the user has multiple selected selfies,
    // merge them in so multi-selfie generations work even if client payload missed IDs
    if (selfies.length === 1) {
      try {
        const moreSelected = await prisma.selfie.findMany({
          where: { personId: selfies[0].personId, selected: true },
          select: { id: true, key: true }
        })
        if (moreSelected.length > 1) {
          const existingIds = new Set(selfies.map(s => s.id))
          const additionalSelfies = moreSelected
            .filter(s => !existingIds.has(s.id))
            .map(s => ({ id: s.id, key: s.key, personId: selfies[0].personId, person: selfies[0].person }))
          selfies.push(...additionalSelfies)
        }
      } catch {}
    }

    // Enforce same person and ownership/team authorization
    const firstPersonId = selfies[0].personId
    const allSamePerson = selfies.every(s => s.personId === firstPersonId)
    if (!allSamePerson) {
      return NextResponse.json({ error: 'All selected selfies must belong to the same person' }, { status: 400 })
    }

    // OPTIMIZATION: Fetch owner person and user person in parallel
    const [ownerPerson, userPerson] = await Promise.all([
      prisma.person.findUnique({
        where: { id: firstPersonId },
        select: { userId: true, teamId: true, inviteToken: true, team: { select: { adminId: true } } }
      }),
      prisma.person.findUnique({ 
        where: { userId: session.user.id }, 
        select: { id: true, teamId: true } 
      })
    ])

    if (!ownerPerson) {
      return NextResponse.json({ error: 'Person not found for selected selfies' }, { status: 404 })
    }
    if (!userPerson) {
      return NextResponse.json({ error: 'User person record not found' }, { status: 404 })
    }
    const isOwner = firstPersonId === userPerson.id
    const isSameTeam = Boolean(userPerson.teamId && ownerPerson.teamId && userPerson.teamId === ownerPerson.teamId)
    if (!isOwner && !isSameTeam) {
      await SecurityLogger.logSuspiciousActivity(session.user.id, 'unauthorized_generation_attempt', { selfiePersonId: firstPersonId })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Multi-selfie recommendation: enforce minimum of 2 if multiple provided
    if (requestedIds.length + requestedKeys.length > 1 && selfies.length < 2) {
      return NextResponse.json({ error: 'Please select at least 2 selfies for generation' }, { status: 400 })
    }

    // Choose primary selfie (first) for legacy fields and relations
    const primarySelfie = selfies[0]
    const selfieS3Keys = selfies.map(s => s.key)

    // Debug logging removed for production security

    // Get user context and determine credit source using centralized logic
    const userContext = await UserService.getUserContext(session.user.id)
    const creditSourceInfo = await CreditService.determineCreditSource(userContext)
    const enforcedCreditSource = creditSourceInfo.creditSource

    // Derive generation type from person's team membership (single source of truth)
    const derivedGenerationType = deriveGenerationType(ownerPerson.teamId)
    const derivedCreditSource = deriveCreditSource(ownerPerson.teamId)

    // Validate that the determined credit source matches the derived one from person data
    // This ensures consistency: if person is in a team, they must use team credits
    if (derivedCreditSource !== enforcedCreditSource) {
      Logger.error('Credit source mismatch', {
        userId: session.user.id,
        personTeamId: ownerPerson.teamId,
        derivedCreditSource,
        enforcedCreditSource,
        reason: creditSourceInfo.reason
      })
      return NextResponse.json({ 
        error: 'Credit source mismatch. Person team membership does not match user role.' 
      }, { status: 400 })
    }

    Logger.debug('Credit source determination', {
      userId: session.user.id,
      creditSource: enforcedCreditSource,
      generationType: derivedGenerationType,
      personTeamId: ownerPerson.teamId,
      reason: creditSourceInfo.reason
    })

    // Additional hard checks for ownership by mode
    if (derivedGenerationType === 'team') {
      if (!ownerPerson.teamId || !isSameTeam) {
        return NextResponse.json({ error: 'Not authorized to create team generation for this person' }, { status: 403 })
      }
    } else {
      // personal
      if (!isOwner) {
        return NextResponse.json({ error: 'Not authorized to create personal generation for another user' }, { status: 403 })
      }
    }

    // Validate package ownership
    const requestedPackageId = (styleSettings?.['packageId'] as string) || PRICING_CONFIG.defaultSignupPackage
    
    // Free package is always accessible to everyone (no ownership check needed)
    if (requestedPackageId !== 'freepackage') {
      type PrismaWithUserPackage = typeof prisma & { 
        userPackage: { 
          findFirst: (...args: unknown[]) => Promise<{ id: string } | null>
        } 
      }
      const prismaEx = prisma as unknown as PrismaWithUserPackage
      
      // For team generations, check if team admin owns the package
      // For personal generations, check if user owns the package
      let userIdToCheck = session.user.id
      if (enforcedCreditSource === 'team' && ownerPerson.teamId) {
        // Team member using team credits - check team admin's package ownership
        // Fetch team to get adminId
          const team = await prisma.team.findUnique({
          where: { id: ownerPerson.teamId },
            select: { adminId: true }
          })
          if (team?.adminId) {
            userIdToCheck = team.adminId
        }
      }
      
      const hasPackage = await prismaEx.userPackage.findFirst({
        where: {
          userId: userIdToCheck,
          packageId: requestedPackageId
        }
      })

      if (!hasPackage) {
        await SecurityLogger.logSuspiciousActivity(
          session.user.id,
          'unauthorized_package_usage',
          { packageId: requestedPackageId, selfieId: primarySelfie.id, userIdChecked: userIdToCheck, creditSource: enforcedCreditSource }
        )
        return NextResponse.json(
          { error: 'You do not have access to this style package.' },
          { status: 403 }
        )
      }
    }

    // Get context if provided (contextId might be a name, not an ID)
    let resolvedContextId = null
    let contextStyleSettings = null
    if (contextId) {
      // First try to find by ID
      let context = await prisma.context.findUnique({
        where: { id: contextId },
        select: { id: true, name: true, settings: true, stylePreset: true }
      })
      
      // If not found by ID, try to find by name
      if (!context) {
        context = await prisma.context.findFirst({
          where: { name: contextId },
          select: { id: true, name: true, settings: true, stylePreset: true }
        })
      }
      
      if (context) {
        resolvedContextId = context.id
        // Use the full settings object instead of just stylePreset string
        contextStyleSettings = context.settings || {}
      }
    }


    // Check credits using CreditService (skip for regenerations which are free)
    if (!isRegeneration) {
      const canAfford = await CreditService.canAffordOperation(
        session.user.id,
        PRICING_CONFIG.credits.perGeneration,
        userContext
      )

      if (!canAfford) {
        // Get detailed credit information for error message
        const creditSummary = await CreditService.getCreditBalanceSummary(session.user.id, userContext)

      if (enforcedCreditSource === 'individual') {
          return NextResponse.json(
            { 
              error: 'Insufficient individual credits',
              required: PRICING_CONFIG.credits.perGeneration,
              available: creditSummary.individual,
              message: 'Please purchase a subscription or credit package to generate photos',
              redirectTo: '/en/app/settings?purchase=required'
            },
            { status: 402 }
          )
      } else {
          // Team credits insufficient
          const personAllocation = await getPersonCreditBalance(primarySelfie.personId)
          return NextResponse.json(
            { 
              error: 'Insufficient team credits',
              required: PRICING_CONFIG.credits.perGeneration,
              available: creditSummary.team,
              personAllocation,
              message: personAllocation > 0 
                ? 'You have allocation remaining but the team has insufficient credits. Contact your team admin.' 
                : 'The team has insufficient credits. Contact your team admin.',
              redirectTo: '/en/app'
            },
            { status: 402 }
          )
        }
      }
    }

    // Handle regeneration logic
    let maxRegenerations = 2 // Default for new generations
    
    if (isRegeneration && originalGenerationId) {
      // This is a regeneration - check the original generation
      const originalGeneration = await prisma.generation.findUnique({
        where: { id: originalGenerationId },
        include: {
          person: {
            select: { userId: true, inviteToken: true }
          }
        }
      })
      
      if (!originalGeneration) {
        return NextResponse.json(
          { error: 'Original generation not found' },
          { status: 404 }
        )
      }
      
      if (originalGeneration.remainingRegenerations <= 0) {
        return NextResponse.json(
          { error: 'No regenerations remaining for this generation' },
          { status: 400 }
        )
      }
      
      // Regenerations cannot be regenerated themselves
      maxRegenerations = 0
      
      // Update the original generation's remaining regenerations (decrement by 1)
      await prisma.generation.update({
        where: { id: originalGenerationId },
        data: { 
          remainingRegenerations: originalGeneration.remainingRegenerations - 1
        }
      })
    } else {
      // This is a new generation - determine user type for regeneration limits
      let userType: 'tryOnce' | 'personal' | 'business' | 'invited' = 'tryOnce'
      
      // Check if user has a subscription
      if (session.user.id) {
        const user = await prisma.user.findUnique({
          where: { id: session.user.id }
        })
        const userPlanTier = (user as unknown as { planTier?: string | null })?.planTier
        if (userPlanTier === 'individual') {
          userType = 'personal'
        } else if (userPlanTier === 'pro') {
          userType = 'business'
        }
      }
      
      // Check if person was invited (has inviteToken)
      if (ownerPerson.inviteToken) {
        userType = 'invited'
      }
      
      maxRegenerations = getRegenerationCount(userType)
    }

    // Handle generation grouping
    let generationGroupId: string
    let isOriginal = true
    let groupIndex = 0

    if (isRegeneration && originalGenerationId) {
      // This is a regeneration - find the original generation's group and context
      const originalGeneration = await prisma.generation.findUnique({
        where: { id: originalGenerationId },
        select: { 
          generationGroupId: true, 
          groupIndex: true,
          contextId: true
        }
      })

      if (originalGeneration) {
        generationGroupId = originalGeneration.generationGroupId || originalGenerationId
        isOriginal = false
        
        // Find the latest groupIndex in this generation group
        const latestInGroup = await prisma.generation.findFirst({
          where: { generationGroupId: generationGroupId },
          orderBy: { groupIndex: 'desc' },
          select: { groupIndex: true },
        })
        groupIndex = (latestInGroup?.groupIndex ?? 0) + 1

        // Copy the context from the original generation
        resolvedContextId = originalGeneration.contextId
      } else {
        // Fallback if original not found
        generationGroupId = originalGenerationId
        isOriginal = false
        groupIndex = 1
      }
    } else {
      // This is an original generation - create new group
      generationGroupId = randomUUID()
      isOriginal = true
      groupIndex = 0
    }

    // Calculate final style settings before creating generation
    const baseStyleSettings: Record<string, unknown> = contextStyleSettings && typeof contextStyleSettings === 'object' && !Array.isArray(contextStyleSettings)
      ? cloneDeep(contextStyleSettings as Record<string, unknown>)
      : {}

    const requestStyleSettings: Record<string, unknown> | null = styleSettings && typeof styleSettings === 'object' && !Array.isArray(styleSettings)
      ? (styleSettings as Record<string, unknown>)
      : null

    let finalStyleSettings: Record<string, unknown> = requestStyleSettings
      ? deepMerge(baseStyleSettings, requestStyleSettings)
      : baseStyleSettings

    // Normalize potential UI variants before serialization
    try {
      const clothing = (finalStyleSettings['clothing'] as { colors?: unknown } | undefined)
      const clothingColors = finalStyleSettings['clothingColors'] as Record<string, unknown> | null | undefined
      // Some UIs may send colors under clothing.colors; lift to clothingColors if present
      if (!clothingColors && clothing && clothing.colors && typeof clothing.colors === 'object') {
        finalStyleSettings['clothingColors'] = { colors: clothing.colors as Record<string, unknown> }
        // keep clothing.colors as-is for backward compatibility; do not delete
      }
    } catch {}
    

    // Enforce free package style for free-plan users or when team admin is on free plan
    try {
      let shouldEnforceFreeStyle = false
      
      if (session.user.id) {
        const userBasic = await prisma.user.findUnique({ where: { id: session.user.id } })
        const basicPlanPeriod = (userBasic as unknown as { planPeriod?: string | null })?.planPeriod
        // Check if user is on free plan
        if (basicPlanPeriod === 'free') {
          shouldEnforceFreeStyle = true
        }
      }
      
      // If using team credits, also check if team admin is on free plan
      if (enforcedCreditSource === 'team' && ownerPerson.teamId) {
        const team = await prisma.team.findUnique({
          where: { id: ownerPerson.teamId },
          include: {
            admin: true
          }
        })
        
        if (team?.admin) {
          const adminPlanPeriod = (team.admin as unknown as { planPeriod?: string | null })?.planPeriod
          if (adminPlanPeriod === 'free') {
            shouldEnforceFreeStyle = true
          }
        }
      }
      
      if (shouldEnforceFreeStyle) {
        type PrismaWithAppSetting = typeof prisma & { appSetting: { findUnique: (...args: unknown[]) => Promise<{ key: string; value: string } | null> } }
        const prismaEx = prisma as unknown as PrismaWithAppSetting
        const setting = await prismaEx.appSetting.findUnique({ where: { key: 'freePackageStyleId' } })
        if (setting?.value) {
          const freeCtx = await prisma.context.findUnique({ where: { id: setting.value }, select: { id: true, settings: true } })
          if (freeCtx && freeCtx.settings) {
            resolvedContextId = freeCtx.id
            // For free plan users, the frontend already sends the correct Free Package style settings
            // with user customizations on user-choice fields. We just need to set the contextId.
            // The finalStyleSettings from the request is already correct.
            Logger.debug('Free plan user or team admin on free plan - using styleSettings from request (already includes Free Package + customizations)')
          }
        }
      }
    } catch (e) {
      Logger.error('Failed to enforce free package style', { error: e instanceof Error ? e.message : String(e) })
    }
    
    if (isRegeneration && originalGenerationId) {
      // Fetch the original generation's styleSettings and context
      const originalGeneration = await prisma.generation.findUnique({
        where: { id: originalGenerationId },
        include: { context: true }
      })
      
      // Use the original generation's saved styleSettings (includes user customizations)
      // This is more accurate than context settings because it contains the actual settings used
      if (originalGeneration?.styleSettings && typeof originalGeneration.styleSettings === 'object' && !Array.isArray(originalGeneration.styleSettings)) {
        finalStyleSettings = originalGeneration.styleSettings as Record<string, unknown>
        Logger.debug('Using styleSettings from original generation', { 
          contextName: originalGeneration.context?.name 
        })
      } else if (originalGeneration?.context?.settings) {
        // Fallback to context settings if generation doesn't have saved styleSettings
        finalStyleSettings = originalGeneration.context.settings as Record<string, unknown>
        Logger.debug('Using context settings from original generation (fallback)', { 
          contextName: originalGeneration.context.name 
        })
      }
    }

    // Serialize style settings with package info
    const finalPackageId = (finalStyleSettings?.['packageId'] as string) || requestedPackageId || 'headshot1'
    const pkg = getPackageConfig(finalPackageId)
    // Persist style settings and also embed selected selfie keys for future regenerations
    const serializedStyleSettingsBase = pkg.persistenceAdapter.serialize(finalStyleSettings)
    const serializedStyleSettings = {
      ...serializedStyleSettingsBase,
      inputSelfies: { keys: selfieS3Keys }
    } as Record<string, unknown>

    // Create generation record
    const generation = await prisma.generation.create({
      data: {
        personId: primarySelfie.personId,
        selfieId: primarySelfie.id,
        contextId: resolvedContextId,
        uploadedPhotoKey: primarySelfie.key,
        generatedPhotoKeys: [], // Will be populated by worker
        // generationType removed - now derived from person.teamId (single source of truth)
        creditSource: enforcedCreditSource,
        status: 'pending',
        creditsUsed: isRegeneration ? 0 : PRICING_CONFIG.credits.perGeneration, // Regenerations are free
        provider: 'gemini',
        maxRegenerations,
        remainingRegenerations: maxRegenerations,
        generationGroupId,
        isOriginal,
        groupIndex,
        styleSettings: serializedStyleSettings as unknown as Parameters<typeof prisma.generation.create>[0]['data']['styleSettings'],
      }
    })

    // Reserve credits using CreditService (skip for regenerations - they are free)
    if (!isRegeneration) {
      try {
        const reservationResult = await CreditService.reserveCreditsForGeneration(
          session.user.id,
          primarySelfie.personId,
          PRICING_CONFIG.credits.perGeneration,
          userContext
        )

        if (!reservationResult.success) {
          Logger.error('Credit reservation failed', { error: reservationResult.error })
          await prisma.generation.delete({ where: { id: generation.id } })
          throw new Error(reservationResult.error || 'Credit reservation failed')
        }

        Logger.debug('Credits reserved successfully', {
          generationId: generation.id,
          transactionId: reservationResult.transactionId,
          individualCreditsUsed: reservationResult.individualCreditsUsed,
          teamCreditsUsed: reservationResult.teamCreditsUsed
        })
      } catch (creditError) {
        // If credit reservation fails, delete the generation record
        await prisma.generation.delete({ where: { id: generation.id } })
        throw creditError
      }
    }

    // Lazy import to avoid build-time issues
    const { imageGenerationQueue } = await import('@/queue')
    
    // Default to the keys from the current selection
    let jobSelfieS3Keys = selfieS3Keys

    // If this is a regeneration and the request did not carry multiple selfies, try to reuse stored keys from the original
    if (isRegeneration && originalGenerationId && (!Array.isArray(jobSelfieS3Keys) || jobSelfieS3Keys.length <= 1)) {
      try {
        const originalGen = await prisma.generation.findUnique({ where: { id: originalGenerationId }, select: { styleSettings: true } })
        const storedKeys = (originalGen?.styleSettings as unknown as { inputSelfies?: { keys?: string[] } } | null)?.inputSelfies?.keys
        if (Array.isArray(storedKeys) && storedKeys.length > 1) {
          jobSelfieS3Keys = storedKeys
        }
      } catch {}
    }

    const job = await imageGenerationQueue.add('generate', {
      generationId: generation.id,
      personId: primarySelfie.personId,
      userId: primarySelfie.person.userId || undefined,
      selfieId: primarySelfie.id,
      selfieS3Key: primarySelfie.key,
      selfieS3Keys: jobSelfieS3Keys,
      styleSettings: serializedStyleSettings,
      prompt,
      providerOptions: {
        model: Env.string('GEMINI_IMAGE_MODEL', 'gemini-2.5-flash-image'),
        numVariations: 4,
      },
      creditSource: enforcedCreditSource,
    }, {
      priority: derivedGenerationType === 'team' ? 1 : 0, // Higher priority for team generations
      jobId: `gen-${generation.id}`, // Custom ID for easier tracking
    })

    Telemetry.increment('generation.create.success')
    
    // Return account mode info to avoid redundant API call on client
    const isPro = userContext.roles.isTeamAdmin ?? false
    const redirectUrl = isPro ? '/app/generations/team' : 
      (session.user?.person?.teamId ? '/app/generations/team' : '/app/generations/personal')
    
    return NextResponse.json({
      success: true,
      generationId: generation.id,
      jobId: job.id,
      status: 'queued',
      message: 'Generation queued successfully',
      accountMode: {
        isPro,
        redirectUrl
      }
    })

  } catch (error) {
    Logger.error('Failed to create generation', { error: error instanceof Error ? error.message : String(error) })
    Telemetry.increment('generation.create.error')
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: error.issues 
        },
        { status: 400 }
      )
    }
    
    if (error instanceof Error && error.message.includes('Insufficient credits')) {
      return NextResponse.json(
        { error: error.message },
        { status: 402 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to process generation request' },
      { status: 500 }
    )
  }
}
