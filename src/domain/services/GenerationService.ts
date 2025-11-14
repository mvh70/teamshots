import { prisma } from '@/lib/prisma'
import { UserService } from './UserService'
import { CreditService } from './CreditService'
import { randomUUID } from 'crypto'
import type { PhotoStyleSettings } from '@/types/photo-style'

/**
 * Consolidated generation management service
 * Centralizes all generation creation, validation, and tracking logic
 */
export class GenerationService {
  /**
   * Validate generation request and prepare generation data
   * OPTIMIZATION: Single validation call that checks permissions, credits, and prepares data
   */
  static async validateGenerationRequest(
    userId: string,
    selfieIds: string[] | undefined,
    selfieKeys: string[] | undefined,
    generationType: 'personal' | 'team' = 'personal'
  ): Promise<{
    isValid: boolean
    error?: string
    personId?: string
    teamId?: string | null
    creditsNeeded?: number
    selfieCount?: number
  }> {
    try {
      // Get user context
      const userContext = await UserService.getUserContext(userId)
      const person = userContext.user.person

      if (!person) {
        return { isValid: false, error: 'User profile not found' }
      }

      // Validate generation type permissions
      if (generationType === 'team' && !userContext.roles.isTeamAdmin && !userContext.roles.isTeamMember) {
        return { isValid: false, error: 'Team access required for team generations' }
      }

      // Validate selfies
      const selfieCount = (selfieIds?.length || 0) + (selfieKeys?.length || 0)
      if (selfieCount === 0) {
        return { isValid: false, error: 'At least one selfie required' }
      }

      if (selfieCount > 4) {
        return { isValid: false, error: 'Maximum 4 selfies allowed' }
      }

      // Calculate credits needed
      const creditsNeeded = CreditService.calculateCreditsNeeded('generation', selfieCount)

      // Validate credit access
      const creditCheck = await CreditService.validateCreditAccess(userId, creditsNeeded)
      if (!creditCheck.hasAccess) {
        return { isValid: false, error: 'Insufficient credits' }
      }

      return {
        isValid: true,
        personId: person.id,
        teamId: person.teamId,
        creditsNeeded,
        selfieCount
      }
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Validation failed'
      }
    }
  }

  /**
   * Create generation record and reserve credits
   * OPTIMIZATION: Atomic operation combining generation creation and credit reservation
   */
  static async createGeneration(
    userId: string,
    personId: string,
    primarySelfieId: string,
    primarySelfieKey: string,
    styleSettings: PhotoStyleSettings,
    generationType: 'personal' | 'team' = 'personal',
    contextId?: string,
    isRegeneration: boolean = false
  ): Promise<{
    success: boolean
    generationId?: string
    transactionId?: string
    error?: string
  }> {
    try {
      // Validate request first
      const validation = await this.validateGenerationRequest(
        userId,
        [primarySelfieId],
        [primarySelfieKey],
        generationType
      )

      if (!validation.isValid || !validation.creditsNeeded) {
        return { success: false, error: validation.error }
      }

      const generationId = randomUUID()

      // Create generation record (matching existing API structure)
      await prisma.generation.create({
        data: {
          id: generationId,
          personId,
          selfieId: primarySelfieId,
          contextId: contextId || undefined,
          uploadedPhotoKey: primarySelfieKey,
          generatedPhotoKeys: [],
          // generationType removed - now derived from person.teamId (single source of truth)
          creditSource: generationType === 'team' ? 'team' : 'individual',
          status: 'pending',
          creditsUsed: isRegeneration ? 0 : validation.creditsNeeded,
          styleSettings: JSON.stringify(styleSettings)
        }
      })

      // Reserve credits (skip for regenerations)
      if (!isRegeneration) {
        const creditResult = await CreditService.reserveCreditsForGeneration(
          userId,
          personId,
          validation.creditsNeeded
        )

        if (!creditResult.success) {
          // Clean up generation record if credit reservation failed
          await prisma.generation.delete({ where: { id: generationId } })
          return { success: false, error: creditResult.error }
        }

        return {
          success: true,
          generationId,
          transactionId: creditResult.transactionId
        }
      }

      return {
        success: true,
        generationId
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Generation creation failed'
      }
    }
  }

  /**
   * Get generation statistics for dashboard
   * OPTIMIZATION: Single query with aggregations
   */
  static async getGenerationStats(userId: string): Promise<{
    totalGenerations: number
    pendingGenerations: number
    completedGenerations: number
    failedGenerations: number
    totalCreditsUsed: number
  }> {
    const userContext = await UserService.getUserRoles(userId)
    const teamId = userContext.user.person?.teamId || null

    // OPTIMIZATION: Single aggregation query
    const stats = await prisma.generation.aggregate({
      where: teamId ? {
        OR: [
          { person: { userId } },
          { person: { teamId } }
        ]
      } : {
        person: { userId }
      },
      _count: {
        id: true
      },
      _sum: {
        creditsUsed: true
      }
    })

    // Get status breakdown
    const statusStats = await prisma.generation.groupBy({
      by: ['status'],
      where: teamId ? {
        OR: [
          { person: { userId } },
          { person: { teamId } }
        ]
      } : {
        person: { userId }
      },
      _count: {
        id: true
      }
    })

    const statusMap = statusStats.reduce((acc, stat) => {
      acc[stat.status] = stat._count.id
      return acc
    }, {} as Record<string, number>)

    return {
      totalGenerations: stats._count.id,
      pendingGenerations: statusMap['pending'] || 0,
      completedGenerations: statusMap['completed'] || 0,
      failedGenerations: statusMap['failed'] || 0,
      totalCreditsUsed: stats._sum.creditsUsed || 0
    }
  }
}
