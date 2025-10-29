/**
 * Create Generation API Endpoint
 * 
 * Enqueues image generation jobs and handles credit validation
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Env } from '@/lib/env'
import { hasSufficientCredits, reserveCreditsForGeneration, getUserCreditBalance } from '@/domain/credits/credits'
import { PRICING_CONFIG } from '@/config/pricing'
import { getRegenerationCount } from '@/domain/pricing'
import { checkRateLimit } from '@/lib/rate-limit'
import { RATE_LIMITS } from '@/config/rate-limit-config'
import { SecurityLogger } from '@/lib/security-logger'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { Logger } from '@/lib/logger'
import { Telemetry } from '@/lib/telemetry'

// Request validation schema
const createGenerationSchema = z.object({
  selfieId: z.string().optional(), // Database ID for selfie
  selfieKey: z.string().optional(), // Alternative: S3 key for selfie
  contextId: z.string().optional(),
  styleSettings: z.object({
    style: z.any().optional(), // Allow any type since it might be an object
    background: z.any().optional(),
    branding: z.any().optional(),
    clothing: z.any().optional(),
    expression: z.any().optional(),
    lighting: z.any().optional(),
  }).optional(),
  prompt: z.string().min(1, 'Prompt is required'),
  generationType: z.enum(['personal', 'company']).default('personal'),
  creditSource: z.enum(['individual', 'company']).default('individual'),
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
    
    const { selfieId, selfieKey, contextId, styleSettings, prompt, generationType, creditSource, isRegeneration, originalGenerationId } = validatedData

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
            include: { company: true }
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
            include: { company: true }
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
                  include: { company: true }
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

    // SECURITY: Verify user owns the selfie or is part of the same company
    const userPerson = await prisma.person.findUnique({
      where: { userId: session.user.id },
      select: { id: true, companyId: true }
    })

    if (!userPerson) {
      return NextResponse.json({ error: 'User person record not found' }, { status: 404 })
    }

    // Check ownership: user must own the selfie OR be in the same company
    const isOwner = selfie.personId === userPerson.id
    const isSameCompany = userPerson.companyId && selfie.person.companyId === userPerson.companyId

    if (!isOwner && !isSameCompany) {
      await SecurityLogger.logSuspiciousActivity(
        session.user.id,
        'unauthorized_generation_attempt',
        { selfieId: selfie.id, selfieOwnerId: selfie.personId }
      )
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
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

    // Determine credit source and check balance
    const personId: string | null = selfie.personId
    const userId: string | null = selfie.person.userId
    
    if (creditSource === 'individual') {
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
      // For company credits, use the company's credits
      if (!selfie.person.companyId) {
        return NextResponse.json(
          { error: 'Person must be part of a company to use company credits' },
          { status: 400 }
        )
      }
      
      const hasCredits = await hasSufficientCredits(null, null, PRICING_CONFIG.credits.perGeneration, selfie.person.companyId)
      if (!hasCredits) {
        return NextResponse.json(
          { 
            error: 'Insufficient company credits',
            required: PRICING_CONFIG.credits.perGeneration,
            available: await getCompanyCreditBalance(selfie.person.companyId),
            message: 'Please purchase a subscription or credit package to generate photos',
            redirectTo: '/en/app/settings?purchase=required'
          },
          { status: 402 }
        )
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
          where: { id: userId },
          select: { subscriptionTier: true, subscriptionStatus: true }
        })
        
        if (user?.subscriptionTier === 'starter' && user?.subscriptionStatus === 'active') {
          userType = 'personal'
        } else if (user?.subscriptionTier === 'pro' && user?.subscriptionStatus === 'active') {
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

    // Create generation record
    const generation = await prisma.generation.create({
      data: {
        personId: selfie.personId,
        selfieId: selfie.id,
        contextId: resolvedContextId,
        uploadedPhotoKey: selfie.key,
        generatedPhotoKeys: [], // Will be populated by worker
        generationType,
        creditSource,
        status: 'pending',
        creditsUsed: PRICING_CONFIG.credits.perGeneration,
        provider: 'gemini',
        maxRegenerations,
        remainingRegenerations: maxRegenerations,
        generationGroupId,
        isOriginal,
        groupIndex,
      }
    })

    // Reserve credits
    try {
      // Get teamInviteId for team members
      let teamInviteId: string | undefined
      if (creditSource === 'company' && selfie.person.inviteToken) {
        const teamInvite = await prisma.teamInvite.findUnique({
          where: { token: selfie.person.inviteToken }
        })
        teamInviteId = teamInvite?.id
      }

      // Debug logging removed for production security
      
      await reserveCreditsForGeneration(
        creditSource === 'individual' ? null : personId,
        creditSource === 'individual' ? userId : null,
        PRICING_CONFIG.credits.perGeneration,
        `Reserved for generation ${generation.id}`,
        creditSource === 'company' ? selfie.person.companyId || undefined : undefined,
        teamInviteId
      )
    } catch (creditError) {
      // If credit reservation fails, delete the generation record
      await prisma.generation.delete({ where: { id: generation.id } })
      throw creditError
    }

    // For regenerations, fetch the context from the database
    let finalStyleSettings: Record<string, unknown> = (styleSettings || contextStyleSettings || {}) as Record<string, unknown>
    
    if (isRegeneration && originalGenerationId) {
      // Fetch the original generation's context
      const originalGeneration = await prisma.generation.findUnique({
        where: { id: originalGenerationId },
        include: { context: true }
      })
      
      if (originalGeneration?.context?.settings) {
        finalStyleSettings = originalGeneration.context.settings as Record<string, unknown>
        Logger.debug('Using context settings from original generation', { contextName: originalGeneration.context.name })
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
      styleSettings: finalStyleSettings,
      prompt,
      providerOptions: {
        model: Env.string('GEMINI_IMAGE_MODEL', 'gemini-2.5-flash-image'),
        numVariations: 4,
      },
      creditSource,
    }, {
      priority: generationType === 'company' ? 1 : 0, // Higher priority for company generations
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

// Helper function to get company credit balance
async function getCompanyCreditBalance(companyId: string): Promise<number> {
  const result = await prisma.creditTransaction.aggregate({
    where: { companyId },
    _sum: { amount: true }
  })
  return result._sum.amount || 0
}
