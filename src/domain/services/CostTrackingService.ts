import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import {
  calculateTokenCost,
  calculateEstimatedCost,
  type AIModelId,
  type AIProvider,
  AI_COST_CONFIG,
} from '@/config/ai-costs'

/**
 * Reason for the AI call
 */
export type CostReason = 'generation' | 'evaluation' | 'refinement' | 'outfit_color_analysis' | 'outfit_collage_creation' | 'clothing_overlay_creation'

/**
 * Result of the AI call
 */
export type CostResult = 'success' | 'failure'

/**
 * Parameters for tracking an AI call
 */
export interface TrackCallParams {
  generationId?: string
  personId?: string
  teamId?: string
  provider: AIProvider
  model: AIModelId
  inputTokens?: number
  outputTokens?: number
  imagesGenerated?: number
  reason: CostReason
  result: CostResult
  errorMessage?: string
  durationMs?: number
  workflowVersion?: string
  stepName?: string
  outputAssetId?: string
  // NEW: Evaluation outcome tracking
  evaluationStatus?: 'approved' | 'rejected'
  rejectionReason?: string
  intermediateS3Key?: string
  // Additional metadata (for outfit analysis, etc.)
  metadata?: Record<string, unknown>
}

/**
 * Parameters for tracking a reuse (cache hit)
 */
export interface TrackReuseParams {
  generationId?: string
  personId?: string
  teamId?: string
  model: AIModelId
  reason: CostReason
  reusedAssetId: string
  workflowVersion?: string
  stepName?: string
}

/**
 * Usage metadata returned from AI clients
 */
export interface UsageMetadata {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  imagesGenerated?: number
  durationMs?: number
}

/**
 * Cost Tracking Service
 *
 * Tracks all AI API calls and their costs. Provides the single source of truth
 * for generation costs (calculated dynamically from GenerationCost records).
 */
export class CostTrackingService {
  /**
   * Track an AI API call and its cost
   */
  static async trackCall(params: TrackCallParams): Promise<{ id: string; estimatedCost: number }> {
    // Calculate cost
    const estimatedCost = this.calculateCost(
      params.model,
      params.inputTokens,
      params.outputTokens,
      params.imagesGenerated
    )

    const costRecord = await prisma.generationCost.create({
      data: {
        generationId: params.generationId,
        personId: params.personId,
        teamId: params.teamId,
        provider: params.provider,
        model: params.model,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        estimatedCost,
        reason: params.reason,
        result: params.result,
        errorMessage: params.errorMessage,
        durationMs: params.durationMs,
        workflowVersion: params.workflowVersion,
        stepName: params.stepName,
        outputAssetId: params.outputAssetId,
        // NEW: Evaluation outcome tracking
        evaluationStatus: params.evaluationStatus,
        rejectionReason: params.rejectionReason,
        intermediateS3Key: params.intermediateS3Key,
      },
    })

    Logger.debug('Cost tracked', {
      costId: costRecord.id,
      generationId: params.generationId,
      model: params.model,
      estimatedCost,
      result: params.result,
    })

    return {
      id: costRecord.id,
      estimatedCost,
    }
  }

  /**
   * Track a cache hit / reuse (no actual API call made)
   * Records the cost that was saved by reusing an existing asset
   */
  static async trackReuse(params: TrackReuseParams): Promise<{ id: string; costSaved: number }> {
    // Calculate cost that would have been incurred
    const costSaved = calculateEstimatedCost(params.model, params.reason)

    const costRecord = await prisma.generationCost.create({
      data: {
        generationId: params.generationId,
        personId: params.personId,
        teamId: params.teamId,
        provider: AI_COST_CONFIG.models[params.model].provider,
        model: params.model,
        estimatedCost: 0, // No cost incurred
        reason: params.reason,
        result: 'success',
        workflowVersion: params.workflowVersion,
        stepName: params.stepName,
        reusedAssetId: params.reusedAssetId,
        costSaved,
      },
    })

    Logger.debug('Reuse tracked', {
      costId: costRecord.id,
      generationId: params.generationId,
      reusedAssetId: params.reusedAssetId,
      costSaved,
    })

    return {
      id: costRecord.id,
      costSaved,
    }
  }

  /**
   * Calculate cost for a given model and token usage
   */
  static calculateCost(
    model: AIModelId,
    inputTokens?: number,
    outputTokens?: number,
    imagesGenerated?: number
  ): number {
    // If we have actual token counts, use them
    if (inputTokens !== undefined || outputTokens !== undefined) {
      return calculateTokenCost(
        model,
        inputTokens ?? 0,
        outputTokens ?? 0,
        imagesGenerated ?? 0
      )
    }

    // Otherwise return 0 (no cost estimate without data)
    return 0
  }

  /**
   * Get total cost for a generation (single source of truth)
   */
  static async getGenerationTotal(generationId: string): Promise<{
    totalCost: number
    totalSaved: number
    callCount: number
    reuseCount: number
    breakdown: Array<{
      stepName: string | null
      reason: string
      cost: number
      saved: number
    }>
  }> {
    const costs = await prisma.generationCost.findMany({
      where: { generationId },
      select: {
        stepName: true,
        reason: true,
        estimatedCost: true,
        costSaved: true,
        reusedAssetId: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    type CostRecord = typeof costs[number];
    const totalCost = costs.reduce((sum: number, c: CostRecord) => sum + c.estimatedCost, 0)
    const totalSaved = costs.reduce((sum: number, c: CostRecord) => sum + (c.costSaved ?? 0), 0)
    const callCount = costs.filter((c: CostRecord) => !c.reusedAssetId).length
    const reuseCount = costs.filter((c: CostRecord) => c.reusedAssetId).length

    const breakdown = costs.map((c: CostRecord) => ({
      stepName: c.stepName,
      reason: c.reason,
      cost: c.estimatedCost,
      saved: c.costSaved ?? 0,
    }))

    return {
      totalCost,
      totalSaved,
      callCount,
      reuseCount,
      breakdown,
    }
  }

  /**
   * Get aggregated costs for a team
   */
  static async getTeamCosts(
    teamId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalCost: number
    totalSaved: number
    generationCount: number
    byModel: Record<string, { cost: number; calls: number }>
    byReason: Record<string, { cost: number; calls: number }>
  }> {
    const whereClause: {
      teamId: string
      createdAt?: { gte?: Date; lte?: Date }
    } = { teamId }

    if (startDate || endDate) {
      whereClause.createdAt = {}
      if (startDate) {
        whereClause.createdAt.gte = startDate
      }
      if (endDate) {
        whereClause.createdAt.lte = endDate
      }
    }

    const costs = await prisma.generationCost.findMany({
      where: whereClause,
      select: {
        generationId: true,
        model: true,
        reason: true,
        estimatedCost: true,
        costSaved: true,
      },
    })

    type UserCostRecord = typeof costs[number];
    const totalCost = costs.reduce((sum: number, c: UserCostRecord) => sum + c.estimatedCost, 0)
    const totalSaved = costs.reduce((sum: number, c: UserCostRecord) => sum + (c.costSaved ?? 0), 0)
    const generationIds = new Set(costs.map((c: UserCostRecord) => c.generationId).filter(Boolean))

    const byModel: Record<string, { cost: number; calls: number }> = {}
    const byReason: Record<string, { cost: number; calls: number }> = {}

    for (const cost of costs) {
      // By model
      if (!byModel[cost.model]) {
        byModel[cost.model] = { cost: 0, calls: 0 }
      }
      byModel[cost.model].cost += cost.estimatedCost
      byModel[cost.model].calls += 1

      // By reason
      if (!byReason[cost.reason]) {
        byReason[cost.reason] = { cost: 0, calls: 0 }
      }
      byReason[cost.reason].cost += cost.estimatedCost
      byReason[cost.reason].calls += 1
    }

    return {
      totalCost,
      totalSaved,
      generationCount: generationIds.size,
      byModel,
      byReason,
    }
  }

  /**
   * Get aggregated costs for a person
   */
  static async getPersonCosts(
    personId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalCost: number
    totalSaved: number
    generationCount: number
  }> {
    const whereClause: {
      personId: string
      createdAt?: { gte?: Date; lte?: Date }
    } = { personId }

    if (startDate || endDate) {
      whereClause.createdAt = {}
      if (startDate) {
        whereClause.createdAt.gte = startDate
      }
      if (endDate) {
        whereClause.createdAt.lte = endDate
      }
    }

    const costs = await prisma.generationCost.findMany({
      where: whereClause,
      select: {
        generationId: true,
        estimatedCost: true,
        costSaved: true,
      },
    })

    type TeamCostRecord = typeof costs[number];
    const totalCost = costs.reduce((sum: number, c: TeamCostRecord) => sum + c.estimatedCost, 0)
    const totalSaved = costs.reduce((sum: number, c: TeamCostRecord) => sum + (c.costSaved ?? 0), 0)
    const generationIds = new Set(costs.map((c: TeamCostRecord) => c.generationId).filter(Boolean))

    return {
      totalCost,
      totalSaved,
      generationCount: generationIds.size,
    }
  }

  /**
   * Get cost statistics for a date range (admin dashboard)
   */
  static async getCostStats(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalCost: number
    totalSaved: number
    totalCalls: number
    successRate: number
    avgCostPerGeneration: number
    byProvider: Record<string, { cost: number; calls: number }>
  }> {
    const costs = await prisma.generationCost.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        generationId: true,
        provider: true,
        estimatedCost: true,
        costSaved: true,
        result: true,
      },
    })

    type StatsCostRecord = typeof costs[number];
    const totalCost = costs.reduce((sum: number, c: StatsCostRecord) => sum + c.estimatedCost, 0)
    const totalSaved = costs.reduce((sum: number, c: StatsCostRecord) => sum + (c.costSaved ?? 0), 0)
    const totalCalls = costs.length
    const successCalls = costs.filter((c: StatsCostRecord) => c.result === 'success').length
    const successRate = totalCalls > 0 ? successCalls / totalCalls : 0

    const generationIds = new Set(costs.map((c: StatsCostRecord) => c.generationId).filter(Boolean))
    const avgCostPerGeneration =
      generationIds.size > 0 ? totalCost / generationIds.size : 0

    const byProvider: Record<string, { cost: number; calls: number }> = {}
    for (const cost of costs) {
      if (!byProvider[cost.provider]) {
        byProvider[cost.provider] = { cost: 0, calls: 0 }
      }
      byProvider[cost.provider].cost += cost.estimatedCost
      byProvider[cost.provider].calls += 1
    }

    return {
      totalCost,
      totalSaved,
      totalCalls,
      successRate,
      avgCostPerGeneration,
      byProvider,
    }
  }
}
