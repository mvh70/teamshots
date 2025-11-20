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

    // Validate the token and get invite data
    const invite = await prisma.teamInvite.findFirst({
      where: {
        token,
        usedAt: { not: null }
      },
      include: {
        team: {
          include: {
            activeContext: true
          }
        },
        context: true
      }
    })

    if (!invite) {
      return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 401 })
    }

    // Get the context - prefer invite.context (the context saved when invite was created)
    // This ensures the invite uses the context it was created with, even if team admin changes active context later
    // Fallback to team.activeContext if invite.context is not available (for backward compatibility)
    const context = invite.context || invite.team.activeContext

    // If no context found, try to get free package context
    let finalContext = context
    if (!finalContext) {
      const setting = await prisma.appSetting.findUnique({ where: { key: 'freePackageStyleId' } })
      if (setting?.value) {
        const freePackageContext = await prisma.context.findUnique({ 
          where: { id: setting.value }
        })
        if (freePackageContext) {
          finalContext = freePackageContext
        }
      }
    }

    if (!finalContext) {
      return NextResponse.json({ error: 'No context found' }, { status: 404 })
    }

    const packageId = (finalContext.settings as Record<string, unknown> | null)?.['packageId'] ?? 'headshot1'

    // Return context with packageId extracted from settings
    // Include backgroundUrl and logoUrl for legacy field normalization
    return NextResponse.json({
      context: {
        id: finalContext.id,
        settings: finalContext.settings,
        stylePreset: finalContext.stylePreset,
        backgroundUrl: finalContext.backgroundUrl,
        logoUrl: finalContext.logoUrl,
        backgroundPrompt: finalContext.backgroundPrompt
      },
      packageId
    })
  } catch (error) {
    Logger.error('Error fetching team member context', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

