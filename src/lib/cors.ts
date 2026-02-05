import { NextRequest, NextResponse } from 'next/server'
import { getRequestHeader } from '@/lib/server-headers'

const allowedOrigins = [
  'http://localhost:3000',
  'https://localhost:3000',
  'https://app.teamshotspro.com',
  'https://www.teamshotspro.com',
  'https://teamshotspro.com',
  'https://app.portreya.com',
  'https://www.portreya.com',
  'https://portreya.com',
  'https://app.swapshotspro.com',
  'https://www.swapshotspro.com',
  'https://swapshotspro.com',
]

/**
 * Check if origin is allowed
 * Supports explicit origins and chrome-extension:// protocol
 */
function isAllowedOrigin(origin: string): boolean {
  // Allow explicit origins
  if (allowedOrigins.includes(origin)) {
    return true
  }

  // Allow all chrome-extension:// origins
  // Security note: Extension still needs valid token for API access
  if (origin.startsWith('chrome-extension://')) {
    return true
  }

  return false
}

export async function corsMiddleware(request: NextRequest, response: NextResponse) {
  const origin = await getRequestHeader('origin')

  if (origin && isAllowedOrigin(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Credentials', 'true')
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Extension-Token'
  )
  response.headers.set('Access-Control-Max-Age', '86400')

  return response
}

/**
 * Handle CORS preflight OPTIONS request
 */
export function handleCorsPreflightSync(origin: string | null): NextResponse | null {
  if (!origin || !isAllowedOrigin(origin)) {
    return null
  }

  const response = new NextResponse(null, { status: 204 })
  response.headers.set('Access-Control-Allow-Origin', origin)
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Extension-Token'
  )
  response.headers.set('Access-Control-Max-Age', '86400')

  return response
}

/**
 * Add CORS headers to a response for extension-compatible endpoints
 */
export function addCorsHeaders(response: NextResponse, origin: string | null): NextResponse {
  if (origin && isAllowedOrigin(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Credentials', 'true')
  }
  return response
}
