import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getToken } from 'next-auth/jwt'
import { Env } from '@/lib/env'
import { Logger } from '@/lib/logger'
import { SESSION_MAX_AGE_SECONDS } from '@/lib/auth'

// Force this route to be dynamic (skip static generation)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Revoke a JWT token by adding it to the blacklist
 */
async function revokeToken(jti: string, userId: string, expiresAt: Date): Promise<void> {
  try {
    // Check if token is already revoked (idempotent)
    const existing = await prisma.revokedToken.findUnique({
      where: { jti }
    })
    
    if (!existing) {
      await prisma.revokedToken.create({
        data: {
          jti,
          userId,
          expiresAt
        }
      })
    }
  } catch (error) {
    Logger.error('Failed to revoke token', { 
      error: error instanceof Error ? error.message : String(error),
      jti,
      userId 
    })
    throw error
  }
}

/**
 * Extract JWT ID (jti) from the session token cookie
 * Uses NextAuth's getToken to properly decode the session token
 */
async function extractJtiFromRequest(request: NextRequest): Promise<string | null> {
  try {
    // Use NextAuth's getToken to decode the session token
    // This handles NextAuth's token encoding/encryption properly
    const token = await getToken({
      req: request,
      secret: Env.string('NEXTAUTH_SECRET')
    })
    
    // jti should be in the decoded token
    return (token?.jti as string) || null
  } catch (error) {
    Logger.warn('Failed to extract jti from session token', {
      error: error instanceof Error ? error.message : String(error)
    })
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get current session to identify user
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    const userId = session.user.id
    
    // Extract JWT ID from the session token
    const jti = await extractJtiFromRequest(request)
    
    if (jti) {
      // Calculate token expiration using the actual SESSION_MAX_AGE_SECONDS constant
      const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000)
      
      // Revoke the specific token
      await revokeToken(jti, userId, expiresAt)
      
      Logger.info('Token revoked on logout', { 
        userId,
        jti 
      })
    } else {
      // If we can't extract jti, log for monitoring
      // The token will still expire naturally (per SESSION_MAX_AGE_SECONDS), and the cookie is cleared
      // This is acceptable because:
      // 1. Tokens have short expiration (15 minutes)
      // 2. Cookie is cleared on logout, making token extraction difficult
      // 3. Most users cannot extract tokens from httpOnly cookies
      Logger.warn('Could not extract jti from session token during logout', {
        userId,
        note: `Token will expire naturally in ${SESSION_MAX_AGE_SECONDS / 60} minutes. Cookie is cleared on logout.`
      })
    }
    
    // Return success - NextAuth's signOut will handle cookie clearing
    return NextResponse.json({ success: true })
  } catch (error) {
    Logger.error('Error in logout endpoint', { 
      error: error instanceof Error ? error.message : String(error)
    })
    // Still return success to allow cookie clearing even if revocation fails
    // The JWT callback will still check for revocation on subsequent requests
    return NextResponse.json({ success: true })
  }
}

