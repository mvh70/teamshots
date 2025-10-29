import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
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
      return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 401 })
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

    // Get generations for the person
    const generations = await prisma.generation.findMany({
      where: {
        personId: person.id,
        deleted: false, // Exclude soft-deleted generations
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        selfie: true,
        context: true
      }
    })

    // Transform the data for the frontend
    const transformedGenerations = generations.map(generation => ({
      id: generation.id,
      selfieKey: generation.selfie?.key || '',
      selfieUrl: generation.selfie?.key ? `/api/files/get?key=${encodeURIComponent(generation.selfie.key)}` : '',
      generatedPhotos: generation.generatedPhotoKeys.map((key, index) => ({
        id: `${generation.id}-${index}`,
        url: `/api/files/get?key=${encodeURIComponent(key)}`,
        style: generation.context?.name || 'Freestyle'
      })),
      status: generation.status,
      createdAt: generation.createdAt.toISOString(),
      generationType: generation.generationType,
      creditsUsed: generation.creditsUsed,
      maxRegenerations: generation.maxRegenerations,
      remainingRegenerations: generation.remainingRegenerations,
      generationGroupId: generation.generationGroupId,
      isOriginal: generation.isOriginal,
      groupIndex: generation.groupIndex
    }))

    return NextResponse.json({ generations: transformedGenerations })
  } catch (error) {
    Logger.error('Error fetching generations', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
