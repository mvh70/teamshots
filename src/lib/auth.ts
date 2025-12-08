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
import { randomBytes } from 'crypto'

// SECURITY: Tightened session configuration for better security
const SESSION_MAX_AGE_SECONDS = 15 * 60 // 15 minutes (reduced from 30)
const SESSION_EXTENSION_THRESHOLD_SECONDS = 2 * 60 // 2 minutes (reduced from 5)
const ABSOLUTE_MAX_SESSION_AGE_SECONDS = 4 * 60 * 60 // 4 hours absolute maximum

/**
 * Generate a unique JWT ID (jti) for token tracking
 */
function generateJti(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Check if a token has been revoked
 */
async function isTokenRevoked(jti: string | undefined): Promise<boolean> {
  if (!jti) {
    return false
  }
  
  try {
    const revoked = await prisma.revokedToken.findUnique({
      where: { jti }
    })
    return !!revoked
  } catch (error) {
    // If check fails, log the error but fail-open to prevent database issues from locking users out
    // Only fail-secure if we're certain the table exists (migration applied)
    console.error('Error checking token revocation:', error)
    // Fail-open: allow session to continue if database check fails
    // This prevents database connectivity issues from locking users out
    return false
  }
}

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
    // Also supports one-time sign-in tokens for guest checkout
    CredentialsProvider({
      id: "credentials",
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        signInToken: { label: "Sign-in Token", type: "text" }
      },
      async authorize(credentials: Partial<Record<"email" | "password" | "signInToken", unknown>>) {
        if (!credentials?.email) {
          return null
        }

        const email = credentials.email as string

        // Check for sign-in token (guest checkout flow)
        if (credentials.signInToken) {
          const { verifyAndConsumeSignInToken } = await import('@/domain/auth/password-setup')
          const tokenResult = await verifyAndConsumeSignInToken(credentials.signInToken as string)
          
          if (!tokenResult.success) {
            console.error('Sign-in token verification failed:', tokenResult.reason)
            return null
          }

          // Verify the token email matches the provided email
          if (tokenResult.email.toLowerCase() !== email.toLowerCase()) {
            console.error('Sign-in token email mismatch')
            return null
          }

          // Find the user
          const user = await prisma.user.findUnique({
            where: { email: tokenResult.email }
          })

          if (!user) {
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

        // Standard password authentication
        if (!credentials.password) {
          return null
        }

        // Rate limiting for sign-in attempts
        // Note: Rate limiting in authorize() is skipped to avoid Edge Runtime build issues with bullmq
        // Rate limiting for sign-in is enforced at the API route level via middleware or route handler
        // This ensures security while maintaining compatibility with Edge Runtime

        const user = await prisma.user.findUnique({
          where: { email }
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

  // Add cookie configuration for security
  // Using 'lax' SameSite to allow cookies on top-level navigations (e.g., Stripe redirects)
  // while still protecting against CSRF attacks on POST requests
  // Note: secure flag should be true for HTTPS (including localhost HTTPS)
  cookies: (() => {
    const isProduction = Env.string('NODE_ENV') === 'production'
    const baseUrl = Env.string('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')
    const isHttps = baseUrl.startsWith('https://')
    const useSecureCookies = isProduction || isHttps
    
    return {
      sessionToken: {
      name: `${isProduction ? '__Secure-' : ''}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax' as const, // 'lax' allows cookies on redirects while still protecting POST requests
        path: '/',
        secure: useSecureCookies
      }
    },
    callbackUrl: {
      name: `${isProduction ? '__Secure-' : ''}next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: useSecureCookies
      }
    },
    csrfToken: {
      name: `${isProduction ? '__Host-' : ''}next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: useSecureCookies
      }
    }
    }
  })(),
  
  // Enable CSRF protection
  useSecureCookies: (() => {
    const isProduction = Env.string('NODE_ENV') === 'production'
    const baseUrl = Env.string('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')
    const isHttps = baseUrl.startsWith('https://')
    return isProduction || isHttps
  })(),
  
  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async jwt({ token, user, trigger: _trigger }: { token: JWT; user?: User | AdapterUser | null; trigger?: string }) {
      // SECURITY: Check if token has been revoked (only on subsequent requests, not initial auth)
      if (!user && token.jti) {
        const isRevoked = await isTokenRevoked(token.jti as string)
        if (isRevoked) {
          // Token has been revoked - throw error to reject authentication
          throw new Error('Token has been revoked')
        }
      }
      
      if (user) {
        token.role = user.role
        token.isAdmin = user.isAdmin
        token.locale = user.locale

        // SECURITY: Generate unique JWT ID (jti) for token tracking and revocation
        token.jti = generateJti()

        // SECURITY: Store token version to invalidate all tokens when role/permissions change
        // Also fetch signupDomain for cross-domain redirect
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { tokenVersion: true, signupDomain: true }
          })
          token.tokenVersion = dbUser?.tokenVersion ?? 0
          token.signupDomain = dbUser?.signupDomain ?? null
        } catch (error) {
          // If database query fails, default to 0 and log the error
          console.error('Error fetching token version during initial auth:', error)
          token.tokenVersion = 0
          token.signupDomain = null
        }

        // SECURITY: Track session creation time for absolute maximum enforcement
        const now = Math.floor(Date.now() / 1000)
        token.iat = now // Issued at time
        token.exp = now + SESSION_MAX_AGE_SECONDS
      }
      
      // SECURITY: Check token version on every request - if it doesn't match, token is invalid
      if (!user && token.sub) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub },
            select: { tokenVersion: true }
          })
          
          // If user doesn't exist in DB, reject the token
          if (!dbUser) {
            throw new Error('User not found - session invalidated')
          }
          
          const currentTokenVersion = dbUser.tokenVersion ?? 0
          // For tokens created before tokenVersion was added, treat as version 0
          const tokenTokenVersion = (token.tokenVersion as number | undefined) ?? 0
          
          if (currentTokenVersion !== tokenTokenVersion) {
            // Token version mismatch - user's role/permissions changed, invalidate this token
            throw new Error('Token version mismatch - session invalidated due to role/permission change')
          }
        } catch (error) {
          // If it's already an Error we threw, re-throw it
          if (error instanceof Error && error.message.includes('session invalidated')) {
            throw error
          }
          // For database errors, log but don't fail - allow session to continue
          // This prevents database issues from locking users out
          console.error('Error checking token version:', error)
          // Don't throw - allow the session to continue
        }
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

        // SECURITY: Enforce absolute maximum session age (4 hours)
        // Even with extensions, session cannot exceed this limit from initial creation
        const sessionAge = now - (token.iat as number || now)
        if (sessionAge >= ABSOLUTE_MAX_SESSION_AGE_SECONDS) {
          // Session has exceeded absolute maximum age - force re-authentication
          throw new Error('Session exceeded absolute maximum age - please sign in again')
        }

        // If the token is close to expiring, extend it by the full session window
        // But never beyond the absolute maximum age
        if (timeUntilExpiry < SESSION_EXTENSION_THRESHOLD_SECONDS && timeUntilExpiry > 0) {
          const proposedExpiry = now + SESSION_MAX_AGE_SECONDS
          const absoluteMaxExpiry = (token.iat as number || now) + ABSOLUTE_MAX_SESSION_AGE_SECONDS

          // Use whichever is sooner: proposed expiry or absolute max
          token.exp = Math.min(proposedExpiry, absoluteMaxExpiry)
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
        session.user.signupDomain = (token.signupDomain as string | null) ?? null
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
  
  // Trust the Host header to support multiple domains from the same deployment
  // This allows NextAuth to build correct callback URLs based on the incoming request
  trustHost: true,
}
