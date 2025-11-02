import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

const { handlers: { GET, POST }, auth: originalAuth } = NextAuth(authOptions)

// Custom auth function that checks for E2E headers and handles impersonation
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

    // Check for impersonation cookie
    const cookieStore = await (async () => {
      try {
        const { cookies } = await import("next/headers")
        return await cookies()
      } catch {
        return null
      }
    })()

    if (cookieStore) {
      try {
        const impersonateUserId = cookieStore.get('impersonate_user_id')?.value
        
        if (impersonateUserId) {
          // First, get the original admin session
          const originalSession = await originalAuth()
          
          if (originalSession?.user?.isAdmin) {
            // Import prisma dynamically to avoid circular dependencies
            const { prisma } = await import("@/lib/prisma")
            
            // Fetch the impersonated user
            const impersonatedUser = await prisma.user.findUnique({
              where: { id: impersonateUserId },
              select: {
                id: true,
                email: true,
                role: true,
                isAdmin: true,
                locale: true
              }
            })

            if (impersonatedUser && !impersonatedUser.isAdmin) {
              // Fetch person data for the impersonated user
              const person = await prisma.person.findUnique({
                where: { userId: impersonatedUser.id },
                include: {
                  team: {
                    select: { id: true, name: true, adminId: true }
                  }
                }
              })

              // Return impersonated session
              return {
                user: {
                  ...originalSession.user,
                  id: impersonatedUser.id,
                  email: impersonatedUser.email,
                  name: person?.firstName || impersonatedUser.email,
                  role: impersonatedUser.role,
                  locale: impersonatedUser.locale,
                  impersonating: true,
                  originalUserId: originalSession.user.id,
                  person: person ? {
                    id: person.id,
                    firstName: person.firstName,
                    lastName: person.lastName,
                    teamId: person.teamId,
                    team: person.team
                  } : undefined
                },
                expires: originalSession.expires
              }
            }
          }
        }
      } catch {
        // If anything fails, fall through to standard auth
      }
    }
  } catch {
    // Catch any unexpected errors during header handling
  }
  
  return originalAuth()
}

export { GET, POST }

