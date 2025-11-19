import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Subscription downgrade is deprecated - now using transactional pricing
export async function POST() {
  return NextResponse.json({
    error: 'Subscription downgrades are no longer available. All plans are now one-time purchases.',
    deprecated: true
  }, { status: 410 }) // 410 Gone
}
