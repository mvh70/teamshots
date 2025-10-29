import { NextRequest, NextResponse } from 'next/server'
import { validateRefreshToken, createRefreshToken, revokeRefreshToken } from '@/lib/refresh-token'
import { sign } from 'jsonwebtoken'
import { getRequestHeader, getRequestIp } from '@/lib/server-headers'
import { Env } from '@/lib/env'

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
  const userAgent = await getRequestHeader('user-agent')
  const ip = (await getRequestIp()) || 'unknown'
  
  const newRefreshToken = await createRefreshToken(validToken.userId, userAgent ?? null, ip)
  
  // Create new access token
  const newAccessToken = sign(
    { 
      userId: validToken.userId, 
      role: validToken.user.role,
      locale: validToken.user.locale 
    },
    Env.string('NEXTAUTH_SECRET'),
    { expiresIn: '15m' }
  )
  
  return NextResponse.json({
    accessToken: newAccessToken,
    refreshToken: newRefreshToken.token,
  })
}
