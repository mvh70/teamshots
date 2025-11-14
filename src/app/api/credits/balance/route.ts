import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { CreditService } from '@/domain/services/CreditService'
import { Logger } from '@/lib/logger'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'individual', 'team', or 'both' (default)

    // OPTIMIZATION: Use CreditService for consolidated credit balance fetching
    if (!type || type === 'both') {
      const balanceSummary = await CreditService.getCreditBalanceSummary(session.user.id)

      return NextResponse.json({
        individual: balanceSummary.individual,
        team: balanceSummary.team
      })
    } else if (type === 'individual') {
      const balanceSummary = await CreditService.getCreditBalanceSummary(session.user.id)
      return NextResponse.json({ balance: balanceSummary.individual })
    } else if (type === 'team') {
      const balanceSummary = await CreditService.getCreditBalanceSummary(session.user.id)
      return NextResponse.json({ balance: balanceSummary.team })
    } else {
      return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
    }
  } catch (error) {
    Logger.error('Error fetching credit balance', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
