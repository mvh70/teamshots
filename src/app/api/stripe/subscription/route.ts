import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Subscription management is deprecated - now using transactional pricing
export async function DELETE() {
  return NextResponse.json({
    error: 'Subscription management is no longer available. All plans are now one-time purchases.',
    deprecated: true
  }, { status: 410 }) // 410 Gone
}

// Subscription management is deprecated - now using transactional pricing
export async function PATCH() {
  return NextResponse.json({
    error: 'Subscription management is no longer available. All plans are now one-time purchases.',
    deprecated: true
  }, { status: 410 }) // 410 Gone
}
