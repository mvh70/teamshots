/**
 * Generations List API Endpoint
 * 
 * Returns a paginated list of generations for the current user
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// Define the type for the generation object returned by prisma.generation.findMany
type GenerationWithRelations = {
  id: string;
  selfieId: string | null;
  status: string;
  generationType: string;
  creditSource: string;
  creditsUsed: number;
  provider: string;
  actualCost: number | null;
  uploadedPhotoKey: string;
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
    company: {
      id: string;
      name: string;
    } | null;
  };
  context: {
    id: string;
    name: string;
    stylePreset: string;
  } | null;
};

export async function GET(request: NextRequest) {
  try {
    // Get user session
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100) // Max 100 per page
    const status = searchParams.get('status')
    const generationType = searchParams.get('type')
    const scope = searchParams.get('scope') as 'personal' | 'team' | null
    const teamView = searchParams.get('teamView') as 'mine' | 'team' | null
    const userId = searchParams.get('userId')
    const offset = (page - 1) * limit

    // Get user with roles to determine permissions
    const { getUserWithRoles, getUserEffectiveRoles } = await import('@/lib/roles')
    const user = await getUserWithRoles(session.user.id)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const roles = getUserEffectiveRoles(user)
    const userCompanyId = user.person?.companyId

    // Build where clause based on scope
    let where: Record<string, unknown> = {}

    if (scope === 'personal') {
      // Personal generations: only user's own personal generations
      where = {
        person: {
          userId: session.user.id
        },
        generationType: 'personal'
      }
    } else if (scope === 'team') {
      if (!userCompanyId) {
        return NextResponse.json({ error: 'Not part of a company' }, { status: 403 })
      }

      if (roles.isCompanyAdmin) {
        // Admin can see all company generations, optionally filtered by user
        where = {
          person: {
            companyId: userCompanyId
          },
          generationType: 'company'
        }
        if (userId && userId !== 'all') {
          (where.person as Record<string, unknown>).id = userId
        }
      } else {
        // Company member (not admin)
        if (teamView === 'mine') {
          // Member's own team generations (both approved and unapproved)
          where = {
            person: {
              userId: session.user.id,
              companyId: userCompanyId
            },
            generationType: 'company'
          }
        } else if (teamView === 'team') {
          // Only approved team generations from others
          where = {
            person: {
              companyId: userCompanyId,
              userId: { not: session.user.id }
            },
            generationType: 'company',
            adminApproved: true
          }
        } else {
          // Default to 'mine' if no teamView specified
          where = {
            person: {
              userId: session.user.id,
              companyId: userCompanyId
            },
            generationType: 'company'
          }
        }
      }
    } else {
      // Fallback to original logic for backward compatibility
      where = {
        OR: [
          // User's own generations
          {
            person: {
              userId: session.user.id
            }
          },
          // Company generations where user is admin
          {
            person: {
              company: {
                adminId: session.user.id
              }
            },
            generationType: 'company'
          }
        ]
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

    // Add generation type filter
    if (generationType) {
      where.generationType = generationType
    }

    // Get generations with pagination
    const [generations, totalCount] = await Promise.all([
      prisma.generation.findMany({
        where: where as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        include: {
          person: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              userId: true, // Make sure userId is selected
              company: {
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
              stylePreset: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: offset,
        take: limit
      }),
      prisma.generation.count({ where: where as any }) // eslint-disable-line @typescript-eslint/no-explicit-any
    ])

    // Transform generations for response
    const transformedGenerations = generations.map((generation: GenerationWithRelations) => ({
      id: generation.id,
      selfieId: generation.selfieId,
      status: generation.status,
      generationType: generation.generationType,
      creditSource: generation.creditSource,
      creditsUsed: generation.creditsUsed,
      provider: generation.provider,
      actualCost: generation.actualCost,
      // Provide keys used by client card components
      uploadedKey: generation.uploadedPhotoKey || undefined, // Original selfie key
      selfieKey: generation.uploadedPhotoKey || undefined, // Same as uploadedKey for consistency
      generatedKey: generation.generatedPhotoKeys[0] || undefined,
      acceptedKey: generation.acceptedPhotoKey || undefined,
      
      // Image counts
      generatedImageCount: generation.generatedPhotoKeys.length,
      hasAcceptedImage: !!generation.acceptedPhotoKey,
      
      // Progress tracking
      maxRegenerations: generation.maxRegenerations,
      remainingRegenerations: generation.remainingRegenerations,
      userApproved: generation.userApproved,
      adminApproved: generation.adminApproved,
      
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
        company: generation.person.company
      },
      context: generation.context,
      
      // Grouping information
      generationGroupId: generation.generationGroupId,
      isOriginal: generation.isOriginal,
      groupIndex: generation.groupIndex,
      
      // Permission flags
      isOwnGeneration: generation.person.userId === session.user.id
    }))

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
    console.error('Failed to get generations list:', error)
    return NextResponse.json(
      { error: 'Failed to get generations list' },
      { status: 500 }
    )
  }
}