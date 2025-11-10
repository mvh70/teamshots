import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getUserSubscription } from '@/domain/subscription/subscription'
import { Logger } from '@/lib/logger'


export const runtime = 'nodejs'
export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const subscription = await getUserSubscription(session.user.id)
    return NextResponse.json({ subscription })
  } catch (error) {
    Logger.error('Error fetching subscription', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 })
  }
}
