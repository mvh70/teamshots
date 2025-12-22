/**
 * Generations List API Endpoint
 *
 * Returns a paginated list of generations for the current user
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-middleware'
import { internalError } from '@/lib/api/errors'

// Disable caching for this route - generation list changes frequently
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { deriveGenerationType } from '@/domain/generation/utils'
import { UserService } from '@/domain/services/UserService'

// Define the type for the generation object returned by prisma.generation.findMany
// Note: generationType is NOT included here because it's derived from person.teamId, not stored in DB
type GenerationWithRelations = {
  id: string;
  status: string;
  creditSource: string;
  creditsUsed: number;
  provider: string;
  generatedPhotoKeys: string[];
  acceptedPhotoKey: string | null;
  userApproved: boolean;
  adminApproved: boolean;
  moderationScore: number | null;
  moderationPassed: boolean;
  moderationDate: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  completedAt: Date | null;
  acceptedAt: Date | null;
  updatedAt: Date;
  deleted: boolean;
  maxRegenerations: number;
  remainingRegenerations: number;
  generationGroupId: string | null;
  isOriginal: boolean;
  groupIndex: number | null;
  person: {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string | null;
    userId: string | null;
    teamId: string | null;
    team: {
      id: string;
      name: string | null;
    } | null;
  };
  context: {
    id: string;
    name: string;
    settings: unknown;
  } | null;
  styleSettings?: unknown;
};

export async function GET(request: NextRequest) {
  try {
    // Get user session
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { userId: sessionUserId } = authResult

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100) // Max 100 per page
    const status = searchParams.get('status')
    // Client cannot choose scope/type; server derives from roles
    const userId = searchParams.get('userId')
    const offset = (page - 1) * limit

    // OPTIMIZATION: Use UserService.getUserContext to get all user data in one call
    const userContext = await UserService.getUserContext(sessionUserId)
    const roles = userContext.roles
    const userTeamId = userContext.teamId

    // Build where clause based on derived scope (roles)
    let where: Record<string, unknown> = {}

    if (roles.isTeamAdmin || roles.isTeamMember) {
      // Team context - filter by person.teamId (derives generationType from person data)
      if (!userTeamId) {
        return NextResponse.json({ error: 'Not part of a team' }, { status: 403 })
      }
      if (roles.isTeamAdmin) {
        where = {
          person: {
            teamId: userTeamId // Team generations have person.teamId set
          }
        }
        if (userId && userId !== 'all') {
          (where.person as Record<string, unknown>).id = userId
        }
      } else {
        // team member sees only own team generations
        where = {
          person: {
            userId: sessionUserId,
            teamId: userTeamId // Team generations have person.teamId set
          }
        }
      }
    } else {
      // Individual context - filter by person.userId AND person.teamId IS NULL
      where = {
        person: {
          userId: sessionUserId,
          teamId: null // Personal generations have person.teamId = null
        }
      }
    }

    // Add status filter (default: hide failed and deleted)
    if (status) {
      where.status = status
    } else {
      where.status = { notIn: ['failed', 'deleted'] }
    }
    
    // Always exclude deleted generations unless explicitly requested
    where.deleted = false

    // Ignore client-provided type filters; server enforces scope

    // Get generations with pagination
    const [generations, totalCount] = await Promise.all([
      prisma.generation.findMany({
        where: where,
        include: {
          person: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              userId: true, // Make sure userId is selected
              teamId: true, // Needed to derive generationType
              team: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          context: {
            select: {
              id: true,
              name: true,
              settings: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: offset,
        take: limit
      }),
      prisma.generation.count({ where: where })
    ])

    // Helper function to get job status for processing generations
    const getJobStatus = async (generationId: string, status: string) => {
      if (status !== 'pending' && status !== 'processing') {
        return null
      }
      try {
        const { imageGenerationQueue } = await import('@/queue')
        const job = await imageGenerationQueue.getJob(`gen-${generationId}`)
        if (job) {
          // Handle progress as either number or object { progress: number, message?: string }
          const progressData = typeof job.progress === 'object' && job.progress !== null
            ? job.progress as { progress?: number; message?: string }
            : { progress: job.progress as number }
          return {
            id: job.id,
            progress: typeof progressData === 'object' && 'progress' in progressData && typeof progressData.progress === 'number'
              ? progressData.progress
              : (typeof job.progress === 'number' ? job.progress : 0),
            message: typeof progressData === 'object' && 'message' in progressData && typeof progressData.message === 'string'
              ? progressData.message
              : undefined,
            attemptsMade: job.attemptsMade,
            processedOn: job.processedOn,
            finishedOn: job.finishedOn,
            failedReason: job.failedReason,
          }
        }
      } catch (error) {
        Logger.warn('Failed to get job status in list', { error: error instanceof Error ? error.message : String(error) })
      }
      return null
    }

    // Get job status for processing generations in parallel
    const processingGenerations = generations.filter(g => g.status === 'pending' || g.status === 'processing')
    const jobStatusPromises = processingGenerations.map(g => getJobStatus(g.id, g.status))
    const jobStatuses = await Promise.all(jobStatusPromises)
    const jobStatusMap = new Map(processingGenerations.map((g, i) => [g.id, jobStatuses[i]]))

    // Transform generations for response
    const transformedGenerations = generations.map((generation: GenerationWithRelations) => {
      // Extract input selfie keys from persisted style settings if present
      let inputSelfieUrls: string[] = []
      let primarySelfieKey: string | undefined = undefined
      try {
        const styles = generation.styleSettings as Record<string, unknown> | null
        const inputSelfies = styles && typeof styles === 'object' ? (styles['inputSelfies'] as Record<string, unknown> | undefined) : undefined
        const keys = inputSelfies && typeof inputSelfies === 'object' ? (inputSelfies['keys'] as unknown) : undefined
        if (Array.isArray(keys)) {
          const validKeys = keys.filter((k): k is string => typeof k === 'string')
          if (validKeys.length > 0) {
            primarySelfieKey = validKeys[0]
            inputSelfieUrls = validKeys.map(key => `/api/files/get?key=${encodeURIComponent(key)}`)
          }
        }
      } catch {
        // ignore malformed style settings
      }

      // Derive generationType from person.teamId (single source of truth)
      const derivedGenerationType = deriveGenerationType(generation.person.teamId)
      
      return ({
      id: generation.id,
      status: generation.status,
      generationType: derivedGenerationType, // Derived from person.teamId, not stored field
      creditSource: generation.creditSource,
      creditsUsed: generation.creditsUsed,
      provider: generation.provider,
      // Provide keys used by client card components
      uploadedKey: primarySelfieKey, // Original selfie key from style settings
      selfieKey: primarySelfieKey, // Same as uploadedKey for consistency
      generatedKey: generation.generatedPhotoKeys[0] || undefined,
      acceptedKey: generation.acceptedPhotoKey || undefined,
      inputSelfieUrls,
      
      // Image counts
      generatedImageCount: generation.generatedPhotoKeys.length,
      hasAcceptedImage: !!generation.acceptedPhotoKey,
      
      // Progress tracking
      maxRegenerations: generation.maxRegenerations,
      remainingRegenerations: generation.remainingRegenerations,
      userApproved: generation.userApproved,
      adminApproved: generation.adminApproved,
      
      // Job status for processing generations
      jobStatus: jobStatusMap.get(generation.id) || null,
      
      // Moderation
      moderationScore: generation.moderationScore,
      moderationPassed: generation.moderationPassed,
      moderationDate: generation.moderationDate,
      
      // Error information
      errorMessage: generation.errorMessage,
      
      // Timestamps
      createdAt: generation.createdAt,
      completedAt: generation.completedAt,
      acceptedAt: generation.acceptedAt,
      updatedAt: generation.updatedAt,
      
      // Related data
      person: {
        id: generation.person.id,
        firstName: generation.person.firstName,
        lastName: generation.person.lastName,
        email: generation.person.email,
        team: generation.person.team
      },
      context: generation.context ? {
        id: generation.context.id,
        name: generation.context.name,
        stylePreset: (generation.context.settings as Record<string, unknown> | undefined)?.stylePreset as string | undefined,
      } : null,
      
      // Grouping information
      generationGroupId: generation.generationGroupId,
      isOriginal: generation.isOriginal,
      groupIndex: generation.groupIndex,
      
      // Permission flags
      // Personal generations (teamId is null) are always owned by the user
      // Team generations check if person.userId matches sessionUserId
      isOwnGeneration: generation.person.teamId === null 
        ? true 
        : generation.person.userId === sessionUserId
    })
    })

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit)
    const hasNextPage = page < totalPages
    const hasPrevPage = page > 1

    return NextResponse.json({
      generations: transformedGenerations,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null,
      }
    })

  } catch (error) {
    Logger.error('Failed to get generations list', { error: error instanceof Error ? error.message : String(error) })
    return internalError('Failed to get generations list')
  }
}