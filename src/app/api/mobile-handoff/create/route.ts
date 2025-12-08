import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createMobileHandoffToken, getMobileHandoffUrl } from '@/lib/mobile-handoff'
import { Logger } from '@/lib/logger'
import { getBaseUrl } from '@/lib/url'
import { headers } from 'next/headers'

export const runtime = 'nodejs'

/**
 * POST /api/mobile-handoff/create
 * Create a mobile handoff token for QR code selfie upload
 * Requires authenticated session
 */
export async function POST() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const headersList = await headers()
    const userAgent = headersList.get('user-agent')

    // Get person ID from session - required for mobile handoff
    const personId = session.user.person?.id

    if (!personId) {
      return NextResponse.json({ error: 'No person record found for user' }, { status: 400 })
    }

    const result = await createMobileHandoffToken(
      session.user.id,
      personId,
      userAgent
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    const baseUrl = getBaseUrl()
    const qrUrl = getMobileHandoffUrl(result.token, baseUrl)

    Logger.info('Mobile handoff token created', {
      userId: session.user.id,
      personId,
      expiresAt: result.expiresAt.toISOString()
    })

    return NextResponse.json({
      token: result.token,
      expiresAt: result.expiresAt.toISOString(),
      qrUrl
    })
  } catch (error) {
    Logger.error('Error creating mobile handoff token', {
      error: error instanceof Error ? error.message : String(error)
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

