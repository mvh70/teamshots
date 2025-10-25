import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"
import { headers } from "next/headers"

const { handlers: { GET, POST }, auth: originalAuth } = NextAuth(authOptions)

// Custom auth function that checks for E2E headers
export async function auth() {
  const headersList = await headers()
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
  
  return originalAuth()
}

export { GET, POST }

