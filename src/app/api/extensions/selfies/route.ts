/**
 * Extension Selfies Endpoint
 *
 * Returns list of user's selfies for the Chrome extension
 * Supports extension token authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getExtensionAuthFromHeaders, EXTENSION_SCOPES } from '@/domain/extension'
import { handleCorsPreflightSync, addCorsHeaders } from '@/lib/cors'
import { Logger } from '@/lib/logger'

export const runtime = 'nodejs'

/**
 * OPTIONS /api/extensions/selfies
 * Handle CORS preflight requests
 */
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin')
  const response = handleCorsPreflightSync(origin)
  return response || new NextResponse(null, { status: 204 })
}

/**
 * GET /api/extensions/selfies
 * Returns user's selfies for selection in the extension
 */
export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin')

  try {
    // Authenticate via extension token
    const extensionAuth = await getExtensionAuthFromHeaders(
      req.headers,
      EXTENSION_SCOPES.GENERATION_CREATE // Reuse generation scope since selfies are needed for generation
    )

    if (!extensionAuth) {
      return addCorsHeaders(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        origin
      )
    }

    const { userId } = extensionAuth

    // Get person for this user
    const person = await prisma.person.findUnique({
      where: { userId },
      select: { id: true }
    })

    if (!person) {
      return addCorsHeaders(
        NextResponse.json({ error: 'Person not found' }, { status: 404 }),
        origin
      )
    }

    // Get selfies for this person (limit to most recent 12)
    const selfies = await prisma.selfie.findMany({
      where: {
        personId: person.id,
        // Include all selfies (remove strict filters for extension use)
      },
      select: {
        id: true,
        key: true,
        selected: true,
        createdAt: true,
        asset: {
          select: {
            width: true,
            height: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 12
    })

    // Transform to include thumbnail URLs
    const selfiesWithUrls = selfies.map(selfie => ({
      id: selfie.id,
      key: selfie.key,
      url: `/api/files/get?key=${encodeURIComponent(selfie.key)}`,
      thumbnailUrl: `/api/files/get?key=${encodeURIComponent(selfie.key)}&w=200`,
      width: selfie.asset?.width || null,
      height: selfie.asset?.height || null,
      selected: selfie.selected
    }))

    Logger.debug('[ExtensionSelfies] Returning selfies', {
      userId,
      count: selfiesWithUrls.length
    })

    return addCorsHeaders(
      NextResponse.json({
        selfies: selfiesWithUrls,
        personId: person.id
      }),
      origin
    )

  } catch (error) {
    Logger.error('[ExtensionSelfies] Error', {
      error: error instanceof Error ? error.message : String(error)
    })

    return addCorsHeaders(
      NextResponse.json({ error: 'Failed to fetch selfies' }, { status: 500 }),
      origin
    )
  }
}
