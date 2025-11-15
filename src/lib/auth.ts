// No default import needed here for v5 handler usage in route
import { PrismaAdapter } from "@auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import ResendProvider from "next-auth/providers/resend"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

import type { Session, User } from "next-auth"
import type { AdapterUser } from "next-auth/adapters"
import type { JWT } from "next-auth/jwt"
import { Env } from '@/lib/env'

const SESSION_MAX_AGE_SECONDS = 30 * 60 // 30 minutes
const SESSION_EXTENSION_THRESHOLD_SECONDS = 5 * 60 // 5 minutes

/**
 * Helper function to fetch and format person data for JWT token
 */
async function fetchPersonForToken(userId: string): Promise<{
  person: {
    id: string
    firstName: string
    lastName?: string | null
    teamId?: string | null
    team?: {
      id: string
      name: string
      adminId: string
    } | null
  }
  givenName: string
} | null> {
  try {
    const person = await prisma.person.findUnique({
      where: { userId },
      include: {
        team: {
          select: { id: true, name: true, adminId: true }
        }
      }
    })
    if (person) {
      return {
        person: {
          id: person.id,
          firstName: person.firstName,
          lastName: person.lastName,
          teamId: person.teamId,
          team: person.team
        },
        givenName: person.firstName
      }
    }
  } catch {}
  return null
}

export const authOptions = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    // Email/password authentication with OTP verification
    CredentialsProvider({
      id: "credentials",
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials: Partial<Record<"email" | "password", unknown>>) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // Rate limiting for sign-in attempts
        // Note: Rate limiting in authorize() is skipped to avoid Edge Runtime build issues with bullmq
        // Rate limiting for sign-in is enforced at the API route level via middleware or route handler
        // This ensures security while maintaining compatibility with Edge Runtime

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string }
        })

        if (!user || !user.password) {
          return null
        }

        const password = credentials.password as string
        const userPasswordHash = user.password as string
        const isPasswordValid = await bcrypt.compare(password, userPasswordHash)

        if (!isPasswordValid) {
          return null
        }
        
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          isAdmin: user.isAdmin,
          locale: user.locale,
        }
      }
    }),

    // Magic link authentication
    ResendProvider({
      apiKey: Env.string('RESEND_API_KEY'),
      from: Env.string('EMAIL_FROM'),
    })
  ],
  
  session: {
    strategy: "jwt" as const,
    maxAge: SESSION_MAX_AGE_SECONDS,
    updateAge: 0, // Force JWT callback to run on every request for rolling session refresh
  },

  // Add cookie configuration for security - Strict SameSite for CSRF protection
  cookies: {
    sessionToken: {
      name: `${Env.string('NODE_ENV') === 'production' ? '__Secure-' : ''}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'strict' as const, // Changed from 'lax' to 'strict' for stronger CSRF protection
        path: '/',
        secure: Env.string('NODE_ENV') === 'production'
      }
    },
    callbackUrl: {
      name: `${Env.string('NODE_ENV') === 'production' ? '__Secure-' : ''}next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: 'strict' as const, // Changed from 'lax' to 'strict'
        path: '/',
        secure: Env.string('NODE_ENV') === 'production'
      }
    },
    csrfToken: {
      name: `${Env.string('NODE_ENV') === 'production' ? '__Host-' : ''}next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'strict' as const, // Changed from 'lax' to 'strict'
        path: '/',
        secure: Env.string('NODE_ENV') === 'production'
      }
    }
  },

  // Enable CSRF protection
  useSecureCookies: Env.string('NODE_ENV') === 'production',
  
  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async jwt({ token, user, trigger: _trigger }: { token: JWT; user?: User | AdapterUser | null; trigger?: string }) {
      if (user) {
        token.role = user.role
        token.isAdmin = user.isAdmin
        token.locale = user.locale
        
        // Set token expiration time when user first authenticates
        const now = Math.floor(Date.now() / 1000)
        token.exp = now + SESSION_MAX_AGE_SECONDS
      }
      
      // Fetch person data if missing (works for both initial auth and subsequent requests)
      // Determine userId - use user.id if available (initial auth), otherwise token.sub (subsequent requests)
      const userId = user?.id || token.sub
      if (userId && !token.person) {
        const personData = await fetchPersonForToken(userId)
        if (personData) {
          token.person = personData.person
          token.givenName = personData.givenName
        }
      }
      
      // Extend token expiration if it's close to expiring (within the configured threshold)
      // Only do this on subsequent requests (not during initial authentication)
      if (!user && token.exp) {
        const now = Math.floor(Date.now() / 1000)
        const expirationTime = token.exp
        const timeUntilExpiry = expirationTime - now
        
        // If the token is close to expiring, extend it by the full session window
        if (timeUntilExpiry < SESSION_EXTENSION_THRESHOLD_SECONDS && timeUntilExpiry > 0) {
          token.exp = now + SESSION_MAX_AGE_SECONDS
        }
      }
      
      return token
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (token) {
        session.user.id = token.sub!
        session.user.role = token.role as string
        session.user.isAdmin = token.isAdmin as boolean
        session.user.locale = token.locale as string
        session.user.person = token.person as {
          id: string
          firstName: string
          lastName?: string | null
          teamId?: string | null
          team?: {
            id: string
            name: string
            adminId: string
          } | null
        } | undefined
        // Prefer person.firstName when available
        if (token.givenName) {
          session.user.name = token.givenName
        }
        // Add impersonation metadata if active
        if (token.impersonating && token.originalUserId) {
          session.user.impersonating = true
          session.user.originalUserId = token.originalUserId as string
        }
      }
      return session
    },
  },
  
  pages: {
    signIn: "/auth/signin",
    signUp: "/auth/signup",
    verifyRequest: "/auth/verify-request",
    error: "/auth/error",
  },
}
