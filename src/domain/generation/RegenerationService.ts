/**
 * RegenerationService
 * 
 * Handles regeneration of existing generations with proper style settings preservation.
 * Consolidates logic previously duplicated across session-based and token-based endpoints.
 */

import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { Env } from '@/lib/env'
import { getPackageConfig } from '@/domain/style/packages'
import { extractPackageId } from '@/domain/style/settings-resolver'
import { imageGenerationQueue } from '@/queue'
import type { Generation } from '@prisma/client'

export interface RegenerateOptions {
  sourceGenerationId: string
  personId: string
  userId?: string
  creditSource: 'individual' | 'team'
}

export interface RegenerationResult {
  generation: Generation
  jobId: string
}

export class RegenerationService {
  /**
   * Regenerates an existing generation with preserved style settings
   */
  static async regenerate(options: RegenerateOptions): Promise<RegenerationResult> {
    const { sourceGenerationId, personId, userId, creditSource } = options

    // Get the source generation to regenerate from
    const sourceGeneration = await prisma.generation.findFirst({
      where: {
        id: sourceGenerationId,
        personId: personId
      },
      include: {
        context: true
      }
    })

    if (!sourceGeneration || !sourceGeneration.selfieId) {
      throw new Error('Generation or selfie not found')
    }

    // Find the original generation in the group to check remaining regenerations
    let originalGeneration = sourceGeneration
    if (!sourceGeneration.isOriginal && sourceGeneration.generationGroupId) {
      const foundOriginal = await prisma.generation.findFirst({
        where: {
          generationGroupId: sourceGeneration.generationGroupId,
          isOriginal: true
        },
        include: {
          context: true
        }
      })
      if (foundOriginal) {
        originalGeneration = foundOriginal
      }
    }

    // Check if regeneration is allowed
    if (originalGeneration.remainingRegenerations <= 0) {
      throw new Error('No regenerations remaining for this generation')
    }

    // Find the latest groupIndex in this generation group
    const latestInGroup = await prisma.generation.findFirst({
      where: { generationGroupId: sourceGeneration.generationGroupId },
      orderBy: { groupIndex: 'desc' },
      select: { groupIndex: true },
    })
    const nextGroupIndex = (latestInGroup?.groupIndex ?? 0) + 1

    // Get style settings from source generation (includes user customizations)
    // Use the source generation's saved styleSettings (most accurate)
    let serializedStyleSettings: Record<string, unknown> = {}
    if (sourceGeneration.styleSettings && typeof sourceGeneration.styleSettings === 'object' && !Array.isArray(sourceGeneration.styleSettings)) {
      // styleSettings from DB are already serialized - use them directly
      serializedStyleSettings = sourceGeneration.styleSettings as Record<string, unknown>
      Logger.debug('Using styleSettings from source generation for regeneration')
    } else if (sourceGeneration.context?.settings) {
      // Fallback to context settings if generation doesn't have saved styleSettings
      // Context settings need to be serialized
      const packageId = extractPackageId(sourceGeneration.context.settings as Record<string, unknown>) || 'headshot1'
      const pkg = getPackageConfig(packageId)
      serializedStyleSettings = pkg.persistenceAdapter.serialize(sourceGeneration.context.settings as Record<string, unknown>)
      Logger.debug('Using context settings from source generation for regeneration (fallback)')
    }

    // Extract stored selfie keys (they're already in the serialized settings)
    const storedSelfieKeys = (serializedStyleSettings as { inputSelfies?: { keys?: string[] } })?.inputSelfies?.keys
    
    // Ensure inputSelfies are included in the serialized settings
    if (!serializedStyleSettings.inputSelfies || !Array.isArray(storedSelfieKeys) || storedSelfieKeys.length === 0) {
      // If no stored keys, try to get from the serialized settings structure
      const keys = Array.isArray(storedSelfieKeys) ? storedSelfieKeys : []
      serializedStyleSettings = {
        ...serializedStyleSettings,
        inputSelfies: { keys }
      }
    }
    
    // For the job, we need to deserialize to get PhotoStyleSettings format
    const packageId = extractPackageId(serializedStyleSettings) || 'headshot1'
    const pkg = getPackageConfig(packageId)
    const finalStyleSettings = pkg.persistenceAdapter.deserialize(serializedStyleSettings)

    // Create new generation record
    const generation = await prisma.generation.create({
      data: {
        personId: personId,
        uploadedPhotoKey: sourceGeneration.uploadedPhotoKey,
        contextId: sourceGeneration.contextId,
        selfieId: sourceGeneration.selfieId,
        status: 'pending',
        maxRegenerations: 0, // Regenerations cannot be regenerated
        remainingRegenerations: 0,
        generationGroupId: sourceGeneration.generationGroupId,
        isOriginal: false,
        groupIndex: nextGroupIndex,
        creditsUsed: 0, // Regenerations don't cost credits
        creditSource: creditSource,
        styleSettings: serializedStyleSettings as unknown as Parameters<typeof prisma.generation.create>[0]['data']['styleSettings'],
      },
    })

    // Update the original generation's remaining regenerations
    await prisma.generation.update({
      where: { id: originalGeneration.id },
      data: {
        remainingRegenerations: originalGeneration.remainingRegenerations - 1
      }
    })
    
    // Queue the generation job
    const jobSelfieS3Keys = Array.isArray(storedSelfieKeys) && storedSelfieKeys.length > 0 
      ? storedSelfieKeys 
      : [sourceGeneration.uploadedPhotoKey]

    const job = await imageGenerationQueue.add('generate', {
      generationId: generation.id,
      personId: personId,
      userId: userId,
      selfieS3Key: sourceGeneration.uploadedPhotoKey,
      selfieS3Keys: jobSelfieS3Keys,
      styleSettings: finalStyleSettings as Record<string, unknown>,
      prompt: 'Professional headshot with same style as original',
      providerOptions: {
        model: Env.string('GEMINI_IMAGE_MODEL'),
        numVariations: 4,
        useV2: true, // Use V2 workflow for regenerations
        debugMode: false,
      },
      creditSource: creditSource,
      selfieId: sourceGeneration.selfieId,
    }, {
      priority: creditSource === 'team' ? 1 : 0,
      jobId: `gen-${generation.id}`,
    })

    Logger.info('Regeneration queued', {
      generationId: generation.id,
      sourceGenerationId: sourceGeneration.id,
      jobId: job.id,
      creditSource
    })

    return {
      generation,
      jobId: job.id || `gen-${generation.id}`
    }
  }
}

