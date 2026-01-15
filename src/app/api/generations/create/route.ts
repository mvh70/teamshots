/**
 * Create Generation API Endpoint
 *
 * Enqueues image generation jobs and handles credit validation
 *
 * Supports both session-based auth and extension token auth (X-Extension-Token header)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { type Session } from 'next-auth'
import { Prisma } from '@/lib/prisma'
import { getExtensionAuthFromHeaders, EXTENSION_SCOPES } from '@/domain/extension'
import { handleCorsPreflightSync, addCorsHeaders } from '@/lib/cors'

export const runtime = 'nodejs'

/**
 * OPTIONS /api/generations/create
 * Handle CORS preflight requests for extension support
 */
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin')
  const response = handleCorsPreflightSync(origin)
  return response || new NextResponse(null, { status: 204 })
}
import { prisma } from '@/lib/prisma'
import { getPersonCreditBalance } from '@/domain/credits/credits'
import { PRICING_CONFIG, type PricingTier, getPricingTier } from '@/config/pricing'
import type { PlanTier, PlanPeriod } from '@/domain/subscription/utils'
import { PACKAGES_CONFIG } from '@/config/packages'
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
import { AssetService } from '@/domain/services/AssetService'
import { RegenerationService } from '@/domain/generation'
import { deriveGenerationType } from '@/domain/generation/utils'
import { resolvePhotoStyleSettings } from '@/domain/style/settings-resolver'
import {
  enqueueGenerationJob,
  determineWorkflowVersion,
} from '@/domain/generation/generation-helpers'


// Request validation schema
const createGenerationSchema = z.object({
  selfieIds: z.array(z.string()).optional(), // NEW: multiple selfies by ID
  selfieKeys: z.array(z.string()).optional(), // NEW: multiple selfies by S3 key
  contextId: z.string().optional(),
  styleSettings: z.object({
    packageId: z.string().optional(), // Package folder name (e.g., 'headshot1', 'freepackage', 'outfit1')
    style: z.any().optional(), // Allow any type since it might be an object
    background: z.any().optional(),
    branding: z.any().optional(),
    clothing: z.any().optional(),
    clothingColors: z.any().optional(),
    customClothing: z.any().optional(), // Outfit transfer settings
    shotType: z.any().optional(),
    expression: z.any().optional(),
    pose: z.any().optional(),
    lighting: z.any().optional(),
  }).optional(),
  prompt: z.string().min(1, 'Prompt is required'),
  isRegeneration: z.boolean().optional().default(false), // Flag to indicate this is a regeneration
  originalGenerationId: z.string().optional(), // ID of the original generation being regenerated
  workflowVersion: z.enum(['v3']).optional(), // Workflow version: v3 (4-step). Defaults to 'v3'
  debugMode: z.boolean().optional().default(false), // Enable debug mode (logs prompts, saves intermediate files)
  stopAfterStep: z.number().int().min(1).max(4).optional(), // Stop workflow after this step (1-4). Useful for testing intermediate results.
})

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')

  try {
    // Authenticate (support both session and extension token)
    let userId: string | null = null
    let session: Session | null = null
    let authSource: 'session' | 'extension' = 'session'

    // Try extension token first (X-Extension-Token header)
    const extensionAuth = await getExtensionAuthFromHeaders(
      request.headers,
      EXTENSION_SCOPES.GENERATION_CREATE
    )
    if (extensionAuth) {
      userId = extensionAuth.userId
      authSource = 'extension'
      Logger.debug('[GenerationCreate] Authenticated via extension token', {
        tokenId: extensionAuth.tokenId,
      })
      // Create a minimal session-like object for extension auth
      session = {
        user: { id: userId },
        expires: new Date(Date.now() + 3600000).toISOString(),
      } as Session
    } else {
      // Fall back to session auth
      session = (await auth()) as Session | null
      if (session?.user?.id) {
        userId = session.user.id
      }
    }

    if (!userId || !session) {
      return addCorsHeaders(
        NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
        origin
      )
    }

    // Rate limiting per user
    const userIdentifier = `generation:user:${userId}`
    const rateLimit = await checkRateLimit(userIdentifier, RATE_LIMITS.generation.limit, RATE_LIMITS.generation.window)

    if (!rateLimit.success) {
      await SecurityLogger.logRateLimitExceeded(userIdentifier)
      return addCorsHeaders(
        NextResponse.json(
          { error: 'Generation rate limit exceeded. Please try again later.' },
          { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.reset - Date.now()) / 1000)) }}
        ),
        origin
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = createGenerationSchema.parse(body)
    
    const { selfieIds, selfieKeys, contextId, styleSettings, prompt, isRegeneration, originalGenerationId, workflowVersion, debugMode, stopAfterStep } = validatedData
    
    // Determine workflow version
    const finalWorkflowVersion = determineWorkflowVersion(workflowVersion)

    // Determine requested selfies (multiple preferred)
    const requestedIds = selfieIds || []
    const requestedKeys = selfieKeys || []

    // Handle regeneration early - no selfies needed, get person from original generation
    if (isRegeneration && originalGenerationId) {
      const originalGeneration = await prisma.generation.findFirst({
        where: { id: originalGenerationId },
        select: { 
          personId: true,
          person: {
            select: {
              userId: true,
              teamId: true,
              inviteToken: true,
              team: { select: { adminId: true } }
            }
          }
        }
      })

      if (!originalGeneration) {
        return NextResponse.json({ error: 'Original generation not found' }, { status: 404 })
      }

      // Get user person for authorization
      const userPerson = await prisma.person.findUnique({ 
        where: { userId: session.user.id }, 
        select: { id: true, teamId: true } 
      })

      if (!userPerson) {
        return NextResponse.json({ error: 'User person record not found' }, { status: 404 })
      }

      // Verify authorization
      const isOwner = originalGeneration.personId === userPerson.id
      const isSameTeam = Boolean(userPerson.teamId && originalGeneration.person.teamId && userPerson.teamId === originalGeneration.person.teamId)
      
      if (!isOwner && !isSameTeam) {
        await SecurityLogger.logSuspiciousActivity(session.user.id, 'unauthorized_regeneration_attempt', { generationId: originalGenerationId })
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }

      // Get user context and determine credit source
      const userContext = await UserService.getUserContext(session.user.id)
      const creditSourceInfo = await CreditService.determineCreditSource(userContext)
      const enforcedCreditSource = creditSourceInfo.creditSource

      try {
        const result = await RegenerationService.regenerate({
          sourceGenerationId: originalGenerationId,
          personId: originalGeneration.personId,
          userId: session.user.id,
          creditSource: enforcedCreditSource,
          workflowVersion: finalWorkflowVersion
        })

        Logger.info('Session-based regeneration completed', {
          generationId: result.generation.id,
          jobId: result.jobId
        })

        // Return account mode info
        const isPro = userContext.roles.isTeamAdmin ?? false
        const hasTeamId = session?.user?.person?.teamId
        const redirectUrl = isPro ? '/app/generations/team' :
          (hasTeamId ? '/app/generations/team' : '/app/generations/personal')

        return NextResponse.json({
          success: true,
          generationId: result.generation.id,
          message: 'Regeneration started successfully',
          redirectUrl,
          accountMode: {
            isPro,
            isTeamMember: !!hasTeamId,
            redirectUrl
          }
        })
      } catch (error) {
        Logger.error('Session-based regeneration error', { 
          error: error instanceof Error ? error.message : String(error) 
        })
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Failed to start regeneration' },
          { status: 500 }
        )
      }
    }

    // For non-regenerations, selfies are required
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
    // Skip this fallback for extension requests - extensions explicitly control which selfies to use
    if (selfies.length === 1 && authSource !== 'extension') {
      try {
        const moreSelected = await prisma.selfie.findMany({
          where: { personId: selfies[0].personId, selected: true },
          select: { id: true, key: true }
        })
        if (moreSelected.length > 1) {
          const existingIds = new Set(selfies.map((s: { id: string }) => s.id))
          type SelectedSelfie = typeof moreSelected[number];
          const additionalSelfies = moreSelected
            .filter((s: SelectedSelfie) => !existingIds.has(s.id))
            .map((s: SelectedSelfie) => ({ id: s.id, key: s.key, personId: selfies[0].personId, person: selfies[0].person }))
          selfies.push(...additionalSelfies)
        }
      } catch {}
    }

    // Enforce same person and ownership/team authorization
    type SelfieType = typeof selfies[number];
    const firstPersonId = selfies[0].personId
    const allSamePerson = selfies.every((s: SelfieType) => s.personId === firstPersonId)
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
    const selfieS3Keys = selfies.map((s: SelfieType) => s.key)

    // Debug logging removed for production security

    // Get user context and determine credit source using centralized logic
    const userContext = await UserService.getUserContext(session.user.id)
    const creditSourceInfo = await CreditService.determineCreditSource(userContext)
    const enforcedCreditSource = creditSourceInfo.creditSource

    // Derive generation type from person's team membership (for tracking purposes)
    const derivedGenerationType = deriveGenerationType(ownerPerson.teamId)

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
    const requestedPackageId = (styleSettings?.['packageId'] as string) || PACKAGES_CONFIG.defaultPlanPackage
    
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
        select: { id: true, name: true, settings: true }
      })
      
      // If not found by ID, try to find by name
      if (!context) {
        context = await prisma.context.findFirst({
          where: { name: contextId },
          select: { id: true, name: true, settings: true }
        })
      }
      
      if (context) {
        resolvedContextId = context.id
        // Use the full settings object instead of just stylePreset string
        contextStyleSettings = context.settings || {}
      }
    }


    // Check credits using CreditService
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

    // Determine regeneration limits for new generations
    // Note: Regenerations are handled early with RegenerationService and return immediately
    // 3 types: Individual, VIP, Invited (not on a plan, credits assigned by team admin)
    let maxRegenerations = 1 // Default for new generations (individual tier)

      // Check if person was invited (has inviteToken) - they're not on a plan
      if (ownerPerson.inviteToken && ownerPerson.teamId) {
        // Invited users get regeneration count from their team admin's plan
        const team = await prisma.team.findUnique({
          where: { id: ownerPerson.teamId },
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
          const adminPlanPeriod = (team.admin as unknown as { planPeriod?: string | null })?.planPeriod as PlanPeriod | null
          const adminPlanTier = (team.admin as unknown as { planTier?: string | null })?.planTier as PlanTier | null

          // Determine team admin's PricingTier from tier+period to get regeneration count
          const adminPricingTier = getPricingTier(adminPlanTier, adminPlanPeriod)
          maxRegenerations = getRegenerationCount(adminPricingTier, adminPlanPeriod)
        } else {
          // Fallback if team admin not found - use individual as default
          maxRegenerations = getRegenerationCount('individual')
        }
      } else if (session.user.id) {
        // Check user's subscription to determine plan
        const user = await prisma.user.findUnique({
          where: { id: session.user.id }
        })
        const userPlanTier = (user as unknown as { planTier?: string | null })?.planTier
        const userPlanPeriod = (user as unknown as { planPeriod?: string | null })?.planPeriod

        let pricingTier: PricingTier = 'free' // Default fallback

        if (userPlanTier === 'individual') {
          // Individual user - check period for VIP vs regular
          if (userPlanPeriod === 'large') {
            pricingTier = 'vip'
          } else {
            pricingTier = 'individual'
          }
        }
        // Pro tier with seats-based pricing
        else if (userPlanTier === 'pro' && userPlanPeriod === 'seats') {
          pricingTier = 'individual' // Use individual regenerations for seats
        }
        // Default for other pro tiers
        else if (userPlanTier === 'pro') {
          pricingTier = 'individual'
        }

        maxRegenerations = getRegenerationCount(pricingTier)
      } else {
        // No user session - default to free
        maxRegenerations = getRegenerationCount('free')
      }

    // Handle generation grouping (for new generations only)
    // Note: Regenerations are handled early with RegenerationService
    const generationGroupId = randomUUID()
    const isOriginal = true
    const groupIndex = 0

    // Calculate final style settings before creating generation
    const packageId = (styleSettings?.packageId as string) || PACKAGES_CONFIG.defaultPlanPackage
    const packageConfig = getPackageConfig(packageId)
    const resolvedPackageId = packageId

    // Server-side category validation: ensure users can only set visible categories
    if (styleSettings) {
      const allowedCategories = new Set([
        ...packageConfig.visibleCategories,
        'packageId',
        'presetId',
        'aspectRatio',
        'subjectCount',
        'usageContext',
        'style' // Legacy field
      ])

      for (const key of Object.keys(styleSettings)) {
        if (!allowedCategories.has(key)) {
          Logger.warn('Attempted to set non-visible category', {
            packageId,
            category: key,
            userId: session.user.id
          })
          return NextResponse.json(
            { error: `Category '${key}' is not allowed for package '${packageId}'` },
            { status: 400 }
          )
        }
      }
    }

    // Convert raw settings to PhotoStyleSettings objects for the resolver
    const contextSettingsObj = contextStyleSettings && typeof contextStyleSettings === 'object' && !Array.isArray(contextStyleSettings)
      ? packageConfig.persistenceAdapter.deserialize(contextStyleSettings as Record<string, unknown>)
      : null

    // Let the package extract UI settings from the raw request data
    const userModificationsObj = styleSettings ? packageConfig.extractUiSettings(styleSettings) : null

    let finalStyleSettingsObj = resolvePhotoStyleSettings(packageId, contextSettingsObj, userModificationsObj)

    // Enforce free package style for free-plan users or when team admin is on free plan
    // Skip enforcement for invited users (they get package from invite)
    try {
      // Skip if person is invited (has inviteToken) - they get package from invite
      if (ownerPerson.inviteToken) {
        Logger.debug('Skipping free package enforcement for invited user')
      } else if (packageId === 'freepackage') {
        let shouldEnforceFreeStyle = false
        
        // Check if user is on free plan
        if (session.user.id) {
          const userBasic = await prisma.user.findUnique({ where: { id: session.user.id } })
          const basicPlanPeriod = (userBasic as unknown as { planPeriod?: string | null })?.planPeriod
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
              // Deserialize admin settings from the context
              const adminSettings = getPackageConfig('freepackage').persistenceAdapter.deserialize(freeCtx.settings as Record<string, unknown>)
              // Merge admin settings (base) with user settings (overlay) - update the object directly
              finalStyleSettingsObj = resolvePhotoStyleSettings('freepackage', adminSettings, finalStyleSettingsObj)
              Logger.debug('Free package - merged admin settings with user customizations')
            }
          }
        }
      }
    } catch (e) {
      Logger.error('Failed to enforce free package style', { error: e instanceof Error ? e.message : String(e) })
    }
    
    // Serialize style settings with package info (for new generations)
    // Note: Regenerations are handled early with RegenerationService
    const pkg = getPackageConfig(resolvedPackageId)
    let serializedStyleSettings = pkg.persistenceAdapter.serialize(finalStyleSettingsObj)
      
    // Normalize potential UI variants after serialization
    try {
      const clothing = (serializedStyleSettings['clothing'] as { colors?: unknown } | undefined)
      const clothingColors = serializedStyleSettings['clothingColors'] as Record<string, unknown> | null | undefined
      // Some UIs may send colors under clothing.colors; lift to clothingColors if present
      if (!clothingColors && clothing && clothing.colors && typeof clothing.colors === 'object') {
        serializedStyleSettings['clothingColors'] = { colors: clothing.colors as Record<string, unknown> }
        // keep clothing.colors as-is for backward compatibility; do not delete
      }
    } catch {}
    
    // Persist style settings and also embed selected selfie keys for future regenerations
    serializedStyleSettings = {
      ...serializedStyleSettings,
      inputSelfies: { keys: selfieS3Keys }
    } as Record<string, unknown>

    // Create generation record
    const generation = await prisma.generation.create({
      data: {
        personId: primarySelfie.personId,
        contextId: resolvedContextId,
        generatedPhotoKeys: [], // Will be populated by worker
        // generationType removed - now derived from person.teamId (single source of truth)
        creditSource: enforcedCreditSource,
        status: 'pending',
        creditsUsed: PRICING_CONFIG.credits.perGeneration, // New generations cost credits
        provider: 'gemini',
        maxRegenerations,
        remainingRegenerations: maxRegenerations,
        generationGroupId,
        isOriginal,
        groupIndex,
        styleSettings: serializedStyleSettings as Prisma.InputJsonValue,
      }
    })

    // Reserve credits using CreditService
    // Note: Regenerations are handled early with RegenerationService and don't reach this code
    try {
      const reservationResult = await CreditService.reserveCreditsForGeneration(
        session.user.id,
        primarySelfie.personId,
        PRICING_CONFIG.credits.perGeneration,
        userContext
      )

      if (!reservationResult.success) {
        Logger.error('Credit reservation failed', { error: reservationResult.error })
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

      Logger.debug('Credits reserved successfully', {
        generationId: generation.id,
        transactionId: reservationResult.transactionId,
        individualCreditsUsed: reservationResult.individualCreditsUsed,
        teamCreditsUsed: reservationResult.teamCreditsUsed
      })
    } catch (creditError) {
      // If credit reservation fails, delete the generation record
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

    // Use the selected selfie keys for the job
    // Note: Regenerations are handled early with RegenerationService
    const jobSelfieS3Keys = selfieS3Keys

    // Resolve selfie S3 keys to Asset IDs for fingerprinting and cost tracking
    // This ensures deterministic fingerprints based on Asset IDs, not S3 keys
    const selfieAssetIds: string[] = []
    try {
      for (const key of jobSelfieS3Keys) {
        const asset = await AssetService.resolveToAsset(key, {
          ownerType: ownerPerson.teamId ? 'team' : 'person',
          teamId: ownerPerson.teamId ?? undefined,
          personId: primarySelfie.personId,
          type: 'selfie',
        })
        selfieAssetIds.push(asset.id)
        
        // Link selfie to asset if not already linked
        const selfie = selfies.find((s: SelfieType) => s.key === key)
        if (selfie) {
          const selfieRecord = await prisma.selfie.findUnique({
            where: { id: selfie.id },
            select: { assetId: true }
          })
          if (!selfieRecord?.assetId) {
            await AssetService.linkSelfieToAsset(selfie.id, asset.id)
          }
        }
      }
      Logger.debug('Resolved selfie assets for generation', {
        generationId: generation.id,
        selfieAssetIds,
        selfieS3Keys: jobSelfieS3Keys,
      })
    } catch (assetError) {
      // Log error but don't fail the generation - asset resolution is for optimization
      Logger.warn('Failed to resolve selfie assets, continuing without asset IDs', {
        generationId: generation.id,
        error: assetError instanceof Error ? assetError.message : String(assetError),
      })
    }

    // Resolve background and logo assets for fingerprinting
    let backgroundAssetId: string | undefined
    let logoAssetId: string | undefined
    try {
      const { getBackgroundIdentifier } = await import('@/domain/style/elements/background/deserializer')
      const { getLogoIdentifier } = await import('@/domain/style/elements/branding/deserializer')

      // Resolve background asset if present
      const bgIdentifier = getBackgroundIdentifier(finalStyleSettingsObj.background)
      if (bgIdentifier) {
        const bgAsset = await AssetService.resolveToAsset(bgIdentifier, {
          ownerType: ownerPerson.teamId ? 'team' : 'person',
          teamId: ownerPerson.teamId ?? undefined,
          personId: primarySelfie.personId,
          type: 'background',
          mimeType: 'image/png',
        })
        backgroundAssetId = bgAsset.id
        Logger.debug('Resolved background asset', {
          generationId: generation.id,
          backgroundAssetId,
          bgIdentifier,
        })
      }

      // Resolve logo asset if present
      const logoIdentifier = getLogoIdentifier(finalStyleSettingsObj.branding)
      if (logoIdentifier) {
        const logoAsset = await AssetService.resolveToAsset(logoIdentifier, {
          ownerType: ownerPerson.teamId ? 'team' : 'person',
          teamId: ownerPerson.teamId ?? undefined,
          personId: primarySelfie.personId,
          type: 'logo',
          mimeType: 'image/png',
        })
        logoAssetId = logoAsset.id
        Logger.debug('Resolved logo asset', {
          generationId: generation.id,
          logoAssetId,
          logoIdentifier,
        })
      }
    } catch (assetError) {
      // Log error but don't fail the generation
      Logger.warn('Failed to resolve style assets, continuing without asset IDs', {
        generationId: generation.id,
        error: assetError instanceof Error ? assetError.message : String(assetError),
      })
    }

    const job = await enqueueGenerationJob({
      generationId: generation.id,
      personId: primarySelfie.personId,
      userId: primarySelfie.person.userId || undefined,
      teamId: ownerPerson.teamId ?? undefined,
      selfieS3Keys: jobSelfieS3Keys,
      selfieAssetIds: selfieAssetIds.length > 0 ? selfieAssetIds : undefined,
      prompt,
      workflowVersion: finalWorkflowVersion,
      debugMode,
      stopAfterStep,
      creditSource: enforcedCreditSource,
      priority: derivedGenerationType === 'team' ? 1 : 0,
    })

    Telemetry.increment('generation.create.success')
    Telemetry.increment(`generation.create.success.${authSource}`)

    // Return account mode info to avoid redundant API call on client
    const isPro = userContext.roles.isTeamAdmin ?? false
    const redirectUrl = isPro
      ? '/app/generations/team'
      : session?.user?.person?.teamId
        ? '/app/generations/team'
        : '/app/generations/personal'

    return addCorsHeaders(
      NextResponse.json({
        success: true,
        generationId: generation.id,
        jobId: job.id,
        status: 'queued',
        message: 'Generation queued successfully',
        accountMode: {
          isPro,
          redirectUrl,
        },
      }),
      origin
    )
  } catch (error) {
    Logger.error('Failed to create generation', {
      error: error instanceof Error ? error.message : String(error),
    })
    Telemetry.increment('generation.create.error')

    if (error instanceof z.ZodError) {
      return addCorsHeaders(
        NextResponse.json({ error: 'Invalid request data', details: error.issues }, { status: 400 }),
        origin
      )
    }

    if (error instanceof Error && error.message.includes('Insufficient credits')) {
      return addCorsHeaders(
        NextResponse.json({ error: error.message }, { status: 402 }),
        origin
      )
    }

    return addCorsHeaders(
      NextResponse.json({ error: 'Failed to process generation request' }, { status: 500 }),
      origin
    )
  }
}
