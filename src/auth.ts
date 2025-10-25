import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

const { handlers: { GET, POST }, auth: originalAuth } = NextAuth(authOptions)

// Custom auth function that checks for E2E headers
export async function auth() {
  try {
    // In build contexts, using async functions that depend on request context
    // can fail. We wrap everything in a try-catch to handle this gracefully.
    const headersList = await (async () => {
      try {
        const { headers } = await import("next/headers")
        return await headers()
      } catch {
        // headers() is not available in build/static contexts
        return null
      }
    })()
    
    if (headersList) {
      try {
        const e2eUserId = headersList.get('x-e2e-user-id')
        
        if (e2eUserId) {
          // Return mock session for E2E tests
          return {
            user: {
              id: e2eUserId,
              email: headersList.get('x-e2e-user-email') || 'test@example.com',
              name: 'Test User',
              role: headersList.get('x-e2e-user-role') || 'user',
              isAdmin: headersList.get('x-e2e-user-is-admin') === 'true',
              locale: headersList.get('x-e2e-user-locale') || 'en'
            },
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          }
        }
      } catch {
        // If anything fails while reading headers, fall through to standard auth
      }
    }
  } catch {
    // Catch any unexpected errors during header handling
  }
  
  return originalAuth()
}

export { GET, POST }

