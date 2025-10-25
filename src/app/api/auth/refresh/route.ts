import { NextRequest, NextResponse } from 'next/server'
import { validateRefreshToken, createRefreshToken, revokeRefreshToken } from '@/lib/refresh-token'
import { sign } from 'jsonwebtoken'

// Force this route to be dynamic (skip static generation)
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const { refreshToken } = await request.json()
  
  if (!refreshToken) {
    return NextResponse.json({ error: 'Refresh token required' }, { status: 400 })
  }
  
  const validToken = await validateRefreshToken(refreshToken)
  
  if (!validToken) {
    return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 })
  }
  
  // Revoke old token
  await revokeRefreshToken(refreshToken)
  
  // Create new tokens
  const userAgent = request.headers.get('user-agent')
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  
  const newRefreshToken = await createRefreshToken(validToken.userId, userAgent, ip)
  
  // Create new access token
  const newAccessToken = sign(
    { 
      userId: validToken.userId, 
      role: validToken.user.role,
      locale: validToken.user.locale 
    },
    process.env.NEXTAUTH_SECRET!,
    { expiresIn: '15m' }
  )
  
  return NextResponse.json({
    accessToken: newAccessToken,
    refreshToken: newRefreshToken.token,
  })
}
