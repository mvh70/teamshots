import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import type { Session } from 'next-auth'

/**
 * Authentication middleware for API routes
 * Returns typed session or error response
 */
export async function requireAuth(): Promise<
  | { session: Session; userId: string }
  | NextResponse<{ error: string }>
> {
  const session = await auth()
  
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  return {
    session,
    userId: session.user.id,
  }
}

