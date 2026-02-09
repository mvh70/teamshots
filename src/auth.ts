import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

const { handlers, auth: originalAuth } = NextAuth(authOptions)

// Export handlers for use in route
export { handlers }

// Custom auth function that handles impersonation
export async function auth() {
  try {
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
              // SECURITY: Log all impersonation actions for audit trail
              try {
                const { SecurityLogger } = await import('@/lib/security-logger')
                await SecurityLogger.logImpersonation(
                  originalSession.user.id,
                  originalSession.user.email,
                  impersonatedUser.id,
                  impersonatedUser.email
                )
              } catch {
                // Log error but don't block impersonation if logging fails
                console.error('Failed to log impersonation')
              }
              
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
    // If anything fails, fall through to standard auth
  }

  return originalAuth()
}
