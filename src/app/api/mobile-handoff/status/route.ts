import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getHandoffTokenStatus } from '@/lib/mobile-handoff'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

/**
 * GET /api/mobile-handoff/status?token=xxx
 * Get the status of a handoff token (for desktop polling)
 * Requires authenticated session (desktop must be logged in)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    const status = await getHandoffTokenStatus(token)

    if (!status) {
      return NextResponse.json({ 
        valid: false,
        expired: true 
      })
    }

    // Get current selfie count if person exists
    let selfieCount = 0
    if (session.user.person?.id) {
      selfieCount = await prisma.selfie.count({
        where: { personId: session.user.person.id }
      })
    }

    return NextResponse.json({
      valid: status.valid,
      deviceConnected: status.deviceConnected,
      lastUsedAt: status.lastUsedAt?.toISOString() || null,
      selfieCount
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

