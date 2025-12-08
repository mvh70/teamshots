/**
 * Asset API - Get Asset
 *
 * Returns asset information and a signed URL for downloading.
 * Requires authentication and proper access permissions.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { Logger } from '@/lib/logger'
import { RATE_LIMITS } from '@/config/rate-limit-config'
import { checkRateLimit } from '@/lib/rate-limit'
import { AssetService } from '@/domain/services/AssetService'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { assetId } = await params

    // Rate limiting
    const rateConfig = RATE_LIMITS.filesGet ?? RATE_LIMITS.api
    const rateIdentifier = `assets:user:${session.user.id}`
    const rateResult = await checkRateLimit(rateIdentifier, rateConfig.limit, rateConfig.window)

    if (!rateResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateResult.reset - Date.now()) / 1000).toString(),
          },
        }
      )
    }

    // Get the asset
    const asset = await AssetService.getAsset(assetId)
    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      )
    }

    // Get user's person for permission context
    const person = await prisma.person.findUnique({
      where: { userId: session.user.id },
      select: { id: true, teamId: true },
    })

    // Check permissions
    const canAccess = await AssetService.canAccess(assetId, {
      userId: session.user.id,
      personId: person?.id,
      teamId: person?.teamId ?? undefined,
      isAdmin: (session.user as { isAdmin?: boolean }).isAdmin ?? false,
    })

    if (!canAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Get signed URL
    const signedUrl = await AssetService.getSignedUrl(assetId, {
      userId: session.user.id,
      personId: person?.id,
      teamId: person?.teamId ?? undefined,
      isAdmin: (session.user as { isAdmin?: boolean }).isAdmin ?? false,
    })

    return NextResponse.json({
      id: asset.id,
      type: asset.type,
      subType: asset.subType,
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
      sizeBytes: asset.sizeBytes,
      createdAt: asset.createdAt,
      url: signedUrl,
    })
  } catch (error) {
    Logger.error('Failed to get asset', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: 'Failed to get asset' },
      { status: 500 }
    )
  }
}
