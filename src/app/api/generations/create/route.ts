/**
 * Create Generation API Endpoint
 * 
 * Enqueues image generation jobs and handles credit validation
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Env } from '@/lib/env'
import { hasSufficientCredits, reserveCreditsForGeneration, getUserCreditBalance, getPersonCreditBalance, getEffectiveTeamCreditBalance } from '@/domain/credits/credits'
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
import { getUserWithRoles, getUserEffectiveRoles } from '@/domain/access/roles'

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
  selfieId: z.string().optional(), // Database ID for selfie
  selfieKey: z.string().optional(), // Alternative: S3 key for selfie
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
    
    const { selfieId, selfieKey, contextId, styleSettings, prompt, isRegeneration, originalGenerationId } = validatedData

    // Debug logging removed for production security

    // Validate that at least one selfie identifier is provided
    if (!selfieId && !selfieKey) {
      return NextResponse.json(
        { error: 'Either selfieId or selfieKey is required' },
        { status: 400 }
      )
    }

    // Get selfie and person information
    let selfie
    if (selfieId) {
      // Try to find by database ID first
      selfie = await prisma.selfie.findUnique({
        where: { id: selfieId },
        include: { 
          person: {
            include: { team: true }
          }
        }
      })
    }
    
    if (!selfie && selfieKey) {
      // Fallback: try to find by S3 key (this might be the uploadedPhotoKey from generation)
      selfie = await prisma.selfie.findFirst({
        where: { key: selfieKey },
        include: { 
          person: {
            include: { team: true }
          }
        }
      })
      
      // If still not found, try to find by looking for a generation with this uploadedPhotoKey
      if (!selfie) {
        Logger.debug('Trying to find selfie through generation with uploadedPhotoKey', { selfieKey })
        const generationWithSelfie = await prisma.generation.findFirst({
          where: { uploadedPhotoKey: selfieKey },
          include: { 
            selfie: {
              include: { 
                person: {
                  include: { team: true }
                }
              }
            }
          }
        })
        if (generationWithSelfie?.selfie) {
          selfie = generationWithSelfie.selfie
        }
      }
    }

    if (!selfie) {
      return NextResponse.json(
        { error: 'Selfie not found' },
        { status: 404 }
      )
    }

    // SECURITY: Verify user owns the selfie or is part of the same team
    const userPerson = await prisma.person.findUnique({
      where: { userId: session.user.id },
      select: { id: true, teamId: true }
    })

    if (!userPerson) {
      return NextResponse.json({ error: 'User person record not found' }, { status: 404 })
    }

    // Check ownership: user must own the selfie OR be in the same team
    const isOwner = selfie.personId === userPerson.id
    const isSameTeam = userPerson.teamId && selfie.person.teamId === userPerson.teamId

    if (!isOwner && !isSameTeam) {
      await SecurityLogger.logSuspiciousActivity(
        session.user.id,
        'unauthorized_generation_attempt',
        { selfieId: selfie.id, selfieOwnerId: selfie.personId }
      )
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Determine enforced generation type and credit source (server-side only)
    const userWithRoles = await getUserWithRoles(session.user.id)
    const effective = userWithRoles ? await getUserEffectiveRoles(userWithRoles) : null
    const isTeamContext = Boolean(effective && (effective.isTeamAdmin || effective.isTeamMember) && selfie.person.teamId)
    const enforcedGenerationType: 'personal' | 'team' = isTeamContext ? 'team' : 'personal'
    const enforcedCreditSource: 'individual' | 'team' = isTeamContext ? 'team' : 'individual'

    // Additional hard checks for ownership by mode
    if (enforcedGenerationType === 'team') {
      if (!selfie.person.teamId || !isSameTeam) {
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
      if (enforcedCreditSource === 'team' && selfie.person.teamId) {
        // Team member using team credits - check team admin's package ownership
        // Fetch team to get adminId if not already loaded
        if (selfie.person.team?.adminId) {
          userIdToCheck = selfie.person.team.adminId
        } else {
          const team = await prisma.team.findUnique({
            where: { id: selfie.person.teamId },
            select: { adminId: true }
          })
          if (team?.adminId) {
            userIdToCheck = team.adminId
          } else {
            // Team not found or has no admin - this shouldn't happen but handle gracefully
            return NextResponse.json(
              { error: 'Team not found or invalid' },
              { status: 404 }
            )
          }
        }
      }
      
      const ownsPackage = await prismaEx.userPackage.findFirst({
        where: { userId: userIdToCheck, packageId: requestedPackageId }
      })

      if (!ownsPackage) {
        await SecurityLogger.logSuspiciousActivity(
          session.user.id,
          'unauthorized_package_usage',
          { packageId: requestedPackageId, selfieId: selfie.id, userIdChecked: userIdToCheck, creditSource: enforcedCreditSource }
        )
        return NextResponse.json(
          { error: `You don't have access to the ${requestedPackageId} package` },
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


    // Determine credit source and check balance (using enforced values)
    // Regenerations are free, so skip credit checks for regenerations
    const personId: string | null = selfie.personId
    const userId: string | null = selfie.person.userId
    
    if (!isRegeneration) {
      // Only check credits for new generations, not regenerations
      if (enforcedCreditSource === 'individual') {
        // For individual credits, use the user's credits
        const hasCredits = await hasSufficientCredits(null, userId, PRICING_CONFIG.credits.perGeneration)
        if (!hasCredits) {
          return NextResponse.json(
            { 
              error: 'Insufficient individual credits',
              required: PRICING_CONFIG.credits.perGeneration,
              available: await getUserCreditBalance(userId!),
              message: 'Please purchase a subscription or credit package to generate photos',
              redirectTo: '/en/app/settings?purchase=required'
            },
            { status: 402 }
          )
        }
      } else {
        // For team credits, use the team's credits
        if (!selfie.person.teamId) {
          return NextResponse.json(
            { error: 'Person must be part of a team to use team credits' },
            { status: 400 }
          )
        }
        
        // Get userId for effective team credit balance
        const teamUser = await prisma.user.findFirst({
          where: {
            person: {
              teamId: selfie.person.teamId
            }
          },
          select: { id: true }
        })
        
        const hasCredits = await hasSufficientCredits(
          null, 
          teamUser?.id || null, 
          PRICING_CONFIG.credits.perGeneration, 
          selfie.person.teamId
        )
        
        if (!hasCredits) {
          const available = await getEffectiveTeamCreditBalance(
            teamUser?.id || session.user.id, 
            selfie.person.teamId
          )
          
          // Check if the person still has allocation left
          const personAllocation = await getPersonCreditBalance(personId)
          
          return NextResponse.json(
            { 
              error: 'Insufficient team credits',
              required: PRICING_CONFIG.credits.perGeneration,
              available,
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
      if (userId) {
        const user = await prisma.user.findUnique({
          where: { id: userId }
        })
        const userPlanTier = (user as unknown as { planTier?: string | null })?.planTier
        if (userPlanTier === 'individual') {
          userType = 'personal'
        } else if (userPlanTier === 'pro') {
          userType = 'business'
        }
      }
      
      // Check if person was invited (has inviteToken)
      if (selfie.person.inviteToken) {
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
      
      if (userId) {
        const userBasic = await prisma.user.findUnique({ where: { id: userId } })
        const basicPlanPeriod = (userBasic as unknown as { planPeriod?: string | null })?.planPeriod
        // Check if user is on free plan
        if (basicPlanPeriod === 'free') {
          shouldEnforceFreeStyle = true
        }
      }
      
      // If using team credits, also check if team admin is on free plan
      if (enforcedCreditSource === 'team' && selfie.person.teamId) {
        const team = await prisma.team.findUnique({
          where: { id: selfie.person.teamId },
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
    const serializedStyleSettings = pkg.persistenceAdapter.serialize(finalStyleSettings)

    // Create generation record
    const generation = await prisma.generation.create({
      data: {
        personId: selfie.personId,
        selfieId: selfie.id,
        contextId: resolvedContextId,
        uploadedPhotoKey: selfie.key,
        generatedPhotoKeys: [], // Will be populated by worker
        generationType: enforcedGenerationType,
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

    // Reserve credits (skip for regenerations - they are free)
    if (!isRegeneration) {
      try {
        // Get teamInviteId for team members
        let teamInviteId: string | undefined
        if (enforcedCreditSource === 'team' && selfie.person.inviteToken) {
          const teamInvite = await prisma.teamInvite.findUnique({
            where: { token: selfie.person.inviteToken }
          })
          teamInviteId = teamInvite?.id
        }

        // Debug logging removed for production security
        
        await reserveCreditsForGeneration(
          enforcedCreditSource === 'individual' ? null : personId,
          enforcedCreditSource === 'individual' ? userId : null,
          PRICING_CONFIG.credits.perGeneration,
          `Reserved for generation ${generation.id}`,
          enforcedCreditSource === 'team' ? selfie.person.teamId || undefined : undefined,
          teamInviteId
        )
      } catch (creditError) {
        // If credit reservation fails, delete the generation record
        await prisma.generation.delete({ where: { id: generation.id } })
        throw creditError
      }
    }

    // Lazy import to avoid build-time issues
    const { imageGenerationQueue } = await import('@/queue')
    
    const job = await imageGenerationQueue.add('generate', {
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
      creditSource: enforcedCreditSource,
    }, {
      priority: enforcedGenerationType === 'team' ? 1 : 0, // Higher priority for team generations
      jobId: `gen-${generation.id}`, // Custom ID for easier tracking
    })

    Telemetry.increment('generation.create.success')
    return NextResponse.json({
      success: true,
      generationId: generation.id,
      jobId: job.id,
      status: 'queued',
      message: 'Generation queued successfully',
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
