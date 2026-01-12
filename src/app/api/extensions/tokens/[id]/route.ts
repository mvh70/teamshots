/**
 * Extension Token Revocation Endpoint
 *
 * DELETE /api/extensions/tokens/[id] - Revoke a specific token
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { revokeExtensionToken } from '@/domain/extension'
import { Logger } from '@/lib/logger'
import { handleCorsPreflightSync, addCorsHeaders } from '@/lib/cors'

export const runtime = 'nodejs'

/**
 * OPTIONS /api/extensions/tokens/[id]
 * Handle CORS preflight requests
 */
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin')
  const response = handleCorsPreflightSync(origin)
  return response || new NextResponse(null, { status: 204 })
}

/**
 * DELETE /api/extensions/tokens/[id]
 * Revoke a specific extension token
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const origin = req.headers.get('origin')

  try {
    const { id: tokenId } = await params

    // Authenticate
    const session = await auth()
    if (!session?.user?.id) {
      return addCorsHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), origin)
    }

    // Revoke token
    const result = await revokeExtensionToken(tokenId, session.user.id)

    if (!result.success) {
      const status = result.error === 'Unauthorized' ? 403 : 400
      return addCorsHeaders(NextResponse.json({ error: result.error }, { status }), origin)
    }

    Logger.info('[ExtensionAPI] Token revoked', {
      userId: session.user.id,
      tokenId,
    })

    return addCorsHeaders(NextResponse.json({ success: true }), origin)
  } catch (error) {
    Logger.error('[ExtensionAPI] Failed to revoke token', {
      error: error instanceof Error ? error.message : String(error),
    })
    return addCorsHeaders(
      NextResponse.json({ error: 'Failed to revoke token' }, { status: 500 }),
      origin
    )
  }
}
