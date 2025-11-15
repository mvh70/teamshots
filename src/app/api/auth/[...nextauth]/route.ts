import { NextRequest, NextResponse } from 'next/server'
import { handlers } from "@/auth"

export const runtime = 'nodejs' // Required: NextAuth uses Prisma and bcryptjs which need Node.js runtime

const { GET: originalGET, POST: originalPOST } = handlers

// Rate limiting wrapper for NextAuth sign-in endpoint
export async function POST(request: NextRequest) {
  // Only apply rate limiting to sign-in requests (POST with credentials)
  const url = request.nextUrl
  if (url.searchParams.get('callbackUrl') || request.headers.get('content-type')?.includes('application/x-www-form-urlencoded')) {
    try {
      // Clone the request before reading the body to avoid "body already consumed" error
      const clonedRequest = request.clone()
      const formData = await clonedRequest.formData()
      const email = formData.get('email') as string | null
      
      if (email) {
        // Apply rate limiting for sign-in attempts
        const { checkRateLimit } = await import('@/lib/rate-limit')
        const { RATE_LIMITS } = await import('@/config/rate-limit-config')
        const { SecurityLogger } = await import('@/lib/security-logger')
        
        const identifier = `signin:${email}`
        const rateLimit = await checkRateLimit(identifier, RATE_LIMITS.signin.limit, RATE_LIMITS.signin.window)
        
        if (!rateLimit.success) {
          await SecurityLogger.logAuthAttempt(email, false)
          return NextResponse.json(
            { error: 'Too many sign-in attempts. Please try again later.' },
            { 
              status: 429, 
              headers: { 
                'Retry-After': String(Math.ceil((rateLimit.reset - Date.now()) / 1000)) 
              }
            }
          )
        }
      }
    } catch {
      // If rate limiting fails, allow the request (fail-open)
    }
  }
  
  // Call original NextAuth handler with the original (unconsumed) request
  return originalPOST(request)
}

export async function GET(request: NextRequest) {
  return originalGET(request)
}
