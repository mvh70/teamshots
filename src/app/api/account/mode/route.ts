import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getAccountMode } from '@/domain/account/accountMode.server'
import { Logger } from '@/lib/logger'


export const runtime = 'nodejs'
/**
 * API endpoint to get account mode
 */
export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ 
        mode: 'individual',
        isPro: false,
        isIndividual: true,
        isTeamMember: false,
        subscriptionTier: null,
        subscriptionPeriod: null,
        hasProTier: false,
      })
    }

    const accountMode = await getAccountMode(session.user.id)
    return NextResponse.json(accountMode)
  } catch (error) {
    Logger.error('Error fetching account mode', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ 
      mode: 'individual',
      isPro: false,
      isIndividual: true,
      isTeamMember: false,
      subscriptionTier: null,
      subscriptionPeriod: null,
      hasProTier: false,
    })
  }
}

