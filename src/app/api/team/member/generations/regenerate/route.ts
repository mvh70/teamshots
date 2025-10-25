import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { imageGenerationQueue } from '@/queue'

interface JobData {
  generationId: string;
  personId: string;
  userId: string | undefined;
  selfieS3Key: string;
  styleSettings: Record<string, unknown>;
  prompt: string;
  providerOptions: {
    model: string;
    numVariations: number;
  };
  creditSource: 'company';
  selfieId: string;
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    // Validate the token and get person data
    const invite = await prisma.teamInvite.findFirst({
      where: {
        token,
        usedAt: { not: null }
      }
    })

    if (!invite) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    // Find the person by email from the invite
    const person = await prisma.person.findFirst({
      where: {
        email: invite.email,
        companyId: invite.companyId
      }
    })

    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    }

    const body = await request.json()
    const { generationId } = body

    if (!generationId) {
      return NextResponse.json({ error: 'Generation ID is required' }, { status: 400 })
    }

    // Get the generation to regenerate from
    const sourceGeneration = await prisma.generation.findFirst({
      where: {
        id: generationId,
        personId: person.id
      },
      include: {
        context: true
      }
    })

    if (!sourceGeneration || !sourceGeneration.selfieId) {
      return NextResponse.json({ error: 'Generation or selfie not found' }, { status: 404 })
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
      return NextResponse.json({ error: 'No regenerations left' }, { status: 400 })
    }

    // Find the latest groupIndex in this generation group
    const latestInGroup = await prisma.generation.findFirst({
      where: { generationGroupId: sourceGeneration.generationGroupId },
      orderBy: { groupIndex: 'desc' },
      select: { groupIndex: true },
    })
    const nextGroupIndex = (latestInGroup?.groupIndex ?? 0) + 1

    // Create new generation record
    const generation = await prisma.generation.create({
      data: {
        personId: person.id,
        uploadedPhotoKey: sourceGeneration.uploadedPhotoKey,
        contextId: sourceGeneration.contextId,
        selfieId: sourceGeneration.selfieId,
        generationType: 'company',
        status: 'pending',
        maxRegenerations: 0, // Regenerations cannot be regenerated
        remainingRegenerations: 0,
        generationGroupId: sourceGeneration.generationGroupId,
        isOriginal: false,
        groupIndex: nextGroupIndex,
        creditsUsed: 0, // Regenerations don't cost credits
        creditSource: 'company',
      },
    })

    // Update the original generation's remaining regenerations
    await prisma.generation.update({
      where: { id: originalGeneration.id },
      data: {
        remainingRegenerations: originalGeneration.remainingRegenerations - 1
      }
    })

    // Add job to queue with context settings
    const finalStyleSettings = (sourceGeneration.context?.settings || {}) as Record<string, unknown>
    
    const jobData: JobData = {
      generationId: generation.id,
      personId: person.id,
      userId: person.userId || undefined,
      selfieS3Key: sourceGeneration.uploadedPhotoKey,
      styleSettings: finalStyleSettings,
      prompt: 'Professional headshot with same style as original',
      providerOptions: {
        model: process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image',
        numVariations: 4,
      },
      creditSource: 'company',
      selfieId: sourceGeneration.selfieId,
    }

    const job = await imageGenerationQueue.add('generate', jobData, {
      priority: 1, // Higher priority for company generations
      jobId: `gen-${generation.id}`,
    })

    console.log('🔄 Team regeneration job queued:', job.id)

    return NextResponse.json({
      success: true,
      generationId: generation.id,
      jobId: job.id
    })

  } catch (error) {
    console.error('Team regeneration error:', error)
    return NextResponse.json(
      { error: 'Failed to start regeneration' },
      { status: 500 }
    )
  }
}
