// No default import needed here for v5 handler usage in route
import { PrismaAdapter } from "@auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import ResendProvider from "next-auth/providers/resend"
import Google from "next-auth/providers/google"
import bcrypt from "bcryptjs"
import { readFileSync } from "node:fs"
import { prisma } from "@/lib/prisma"

import type { Session, User } from "next-auth"
import type { AdapterUser } from "next-auth/adapters"
import type { JWT } from "next-auth/jwt"
import { Env } from '@/lib/env'
import { randomBytes } from 'crypto'
import { BRAND_CONFIG } from '@/config/brand'
import MagicLinkEmail from '@/emails/MagicLink'
import { render } from '@react-email/render'
import { getEmailTranslation } from '@/lib/translations'

// SECURITY: Tightened session configuration for better security
// Exported so other modules can use consistent session timing
export const SESSION_MAX_AGE_SECONDS = 15 * 60 // 15 minutes (reduced from 30)
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
      name: string | null
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

// Custom adapter that wraps PrismaAdapter to handle schema differences
// Our User model doesn't have 'name' or 'image' fields that OAuth providers send
// Also sets default values for OAuth users and creates Person/Team in one transaction
const customAdapter = (() => {
  const baseAdapter = PrismaAdapter(prisma)
  return {
    ...baseAdapter,
    // Override createUser to strip unsupported fields and set defaults for OAuth users
    // Also creates Person and Team (if team domain) in the same transaction
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createUser: async (data: any) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { name, image, ...userData } = data

      // Extract first/last name from OAuth profile name
      const nameParts = (name || '').split(' ')
      const firstName = nameParts[0] || 'User'
      const lastName = nameParts.slice(1).join(' ') || null

      // Capture domain from request headers using same logic as getRequestDomain
      let domain: string | null = null
      try {
        const { headers } = await import('next/headers')
        const headersList = await headers()

        // Prioritize x-forwarded-host (original client request) over host
        let host = headersList.get('x-forwarded-host')
        if (host) {
          host = host.split(',')[0].trim()
        } else {
          host = headersList.get('host')
        }

        if (host) {
          const hostname = host.split(':')[0].toLowerCase().trim()
          if (hostname === 'localhost') {
            // Use forced domain for localhost (development/testing)
            const forcedDomain = process.env.NEXT_PUBLIC_FORCE_DOMAIN
            domain = forcedDomain ? forcedDomain.replace(/^www\./, '').toLowerCase() : null
          } else {
            domain = hostname.replace(/^www\./, '')
          }
        }
      } catch {
        // Headers not available in this context
      }

      // Use existing domain logic to determine signup type
      const { getSignupTypeFromDomain } = await import('@/lib/domain')
      const { PRICING_CONFIG } = await import('@/config/pricing')
      const { getDefaultPackage } = await import('@/config/landing-content')

      const userType = getSignupTypeFromDomain(domain) || 'individual'

      // Determine role and planTier based on signup type (same as registration route)
      const role = userType === 'team' ? 'team_admin' : 'user'
      const planTier = userType === 'team' ? 'pro' : 'individual'
      const freeCredits = userType === 'team'
        ? PRICING_CONFIG.freeTrial.pro
        : PRICING_CONFIG.freeTrial.individual
      const packageId = getDefaultPackage(domain || undefined)

      // Don't store localhost as signupDomain
      const signupDomain = domain && domain !== 'localhost' ? domain : null

      // Create User, Person, and Team (if applicable) in a single transaction
      const result = await prisma.$transaction(async (tx) => {
        // 1. Create User
        const user = await tx.user.create({
          data: {
            ...userData,
            role,
            planTier,
            planPeriod: 'free',
            freeTrialGrantedAt: new Date(),
            signupDomain,
          }
        })

        // 2. Create Person
        const person = await tx.person.create({
          data: {
            userId: user.id,
            firstName,
            lastName,
            email: userData.email,
            onboardingState: JSON.stringify({
              state: 'not_started',
              completedTours: [],
              pendingTours: [],
              lastUpdated: new Date().toISOString(),
            }),
          }
        })

        // 3. Create Team if team domain
        let teamId: string | null = null
        if (userType === 'team') {
          const team = await tx.team.create({
            data: {
              name: null,
              adminId: user.id,
              teamMembers: {
                connect: { id: person.id }
              }
            }
          })

          // Link person to team
          await tx.person.update({
            where: { id: person.id },
            data: { teamId: team.id }
          })

          teamId = team.id
        }

        // 4. Grant free trial credits
        await tx.creditTransaction.create({
          data: {
            personId: person.id,
            credits: freeCredits,
            type: 'free_grant',
            description: 'Free trial credits',
            planTier,
            planPeriod: 'free',
          }
        })

        // 5. Create subscription change record
        await tx.subscriptionChange.create({
          data: {
            userId: user.id,
            planTier,
            planPeriod: 'free',
            action: 'start',
          }
        })

        // 6. Grant default package
        await tx.userPackage.create({
          data: {
            userId: user.id,
            packageId,
            purchasedAt: new Date()
          }
        })

        return { user, person, teamId }
      })

      return result.user
    },
  }
})()

type GoogleCredentials = {
  clientId: string
  clientSecret: string
  source: string
}

function getGoogleCredentials(): GoogleCredentials | null {
  // Preferred for production: direct env vars
  const envClientId = process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID
  const envClientSecret = process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET

  if (envClientId && envClientSecret) {
    return {
      clientId: envClientId,
      clientSecret: envClientSecret,
      source: 'environment variables',
    }
  }

  if (envClientId || envClientSecret) {
    console.warn('Google OAuth is partially configured: both client ID and client secret must be set')
  }

  // Local/dev fallback: OAuth client JSON file path
  const credentialsPath = Env.string('GOOGLE_OAUTH_CREDENTIALS', '').trim()
  if (!credentialsPath) {
    return null
  }

  try {
    const raw = readFileSync(credentialsPath, 'utf-8')
    const credentials = JSON.parse(raw)
    const { client_id, client_secret } = credentials.installed || credentials.web || credentials
    if (!client_id || !client_secret) {
      console.warn(`Google OAuth credentials file is missing client_id/client_secret: ${credentialsPath}`)
      return null
    }
    return {
      clientId: client_id,
      clientSecret: client_secret,
      source: `credentials file (${credentialsPath})`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`Failed to load Google OAuth credentials from ${credentialsPath}: ${message}`)
    return null
  }
}

export const authOptions = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: customAdapter as any,
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
      id: 'email',
      apiKey: Env.string('RESEND_API_KEY'),
      from: Env.string('EMAIL_FROM') || `${BRAND_CONFIG.name} <${BRAND_CONFIG.contact.hello}>`,
      async sendVerificationRequest({ identifier: email, url, provider }) {
        // Detect locale from email domain or default to 'en'
        // For now, default to 'en' - could be enhanced to detect from user preferences
        const locale = 'en' as 'en' | 'es'

        // Parse the URL to extract and fix the callbackUrl
        // The url parameter contains the full callback URL with token
        // We need to ensure the callbackUrl points to dashboard, not verify-request
        const urlObj = new URL(url)
        const currentCallbackUrl = urlObj.searchParams.get('callbackUrl')

        // If callbackUrl points to verify-request, replace it with dashboard
        if (currentCallbackUrl && currentCallbackUrl.includes('/auth/verify-request')) {
          // Extract the original callbackUrl from the verify-request URL if present
          const verifyRequestUrl = new URL(currentCallbackUrl, urlObj.origin)
          const originalCallbackUrl = verifyRequestUrl.searchParams.get('callbackUrl') || '/app/dashboard'

          // Update the callbackUrl in the magic link URL
          urlObj.searchParams.set('callbackUrl', originalCallbackUrl)
        } else if (!currentCallbackUrl) {
          // If no callbackUrl, default to dashboard
          urlObj.searchParams.set('callbackUrl', '/app/dashboard')
        }

        const magicLinkUrl = urlObj.toString()

        const subject = getEmailTranslation('magicLink.subject', locale)

        // Render the React email template to HTML
        const html = await render(
          MagicLinkEmail({
            magicLink: magicLinkUrl,
            locale,
          })
        )

        // Also provide plain text fallback
        const text = getEmailTranslation('magicLink.body', locale, { link: magicLinkUrl })

        try {
          const { Resend } = await import('resend')
          const resend = new Resend(provider.apiKey)

          await resend.emails.send({
            from: provider.from as string,
            to: email,
            subject,
            html,
            text,
          })
        } catch (error) {
          console.error('Failed to send magic link email:', error)
          throw error
        }
      },
    }),

    // Google OAuth authentication
    // allowDangerousEmailAccountLinking is safe for Google because they always verify emails
    // Loads from AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET (preferred), GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET,
    // or JSON path via GOOGLE_OAUTH_CREDENTIALS (local/dev fallback).
    ...(() => {
      const credentials = getGoogleCredentials()
      if (!credentials) {
        if (Env.string('NODE_ENV', 'development') === 'production') {
          console.warn('Google OAuth provider disabled in production: no valid credentials found')
        }
        return []
      }
      console.info(`Google OAuth provider enabled via ${credentials.source}`)
      return [Google({
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        allowDangerousEmailAccountLinking: true,
      })]
    })(),
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
    /**
     * signIn callback - handles OAuth user setup (Person creation, free trial credits)
     * This runs after the OAuth provider validates the user but before the session is created
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
    async signIn({ user, account }: { user: User | AdapterUser; account?: any; profile?: any }) {
      // For OAuth/OIDC sign-ins, the customAdapter.createUser handles all setup
      // (User, Person, Team, credits, package) in a single transaction.
      return true
    },

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

    /**
     * Redirect callback - strips incorrect :80 port from https URLs.
     *
     * This fixes an issue where reverse proxies forward x-forwarded-port: 80,
     * causing NextAuth (with trustHost: true) to construct URLs like
     * https://domain.com:80/ which break HTTPS connections.
     *
     * Also allows cross-domain redirects between our allowed domains
     * (e.g., portreya.com user logging out should stay on portreya.com)
     */
    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      // Import allowed domains for cross-domain redirect validation
      const { ALLOWED_DOMAINS } = await import('@/lib/url')

      const stripDefaultPort = (u: string): string => {
        try {
          const parsed = new URL(u)
          // Strip :80 from https (the bug), and standard defaults
          if (parsed.protocol === 'https:' && parsed.port === '80') {
            parsed.port = ''
          } else if (parsed.protocol === 'https:' && parsed.port === '443') {
            parsed.port = ''
          } else if (parsed.protocol === 'http:' && parsed.port === '80') {
            parsed.port = ''
          }
          return parsed.toString()
        } catch {
          return u
        }
      }

      const cleanedBaseUrl = stripDefaultPort(baseUrl)

      // Handle relative URLs
      if (url.startsWith('/')) {
        return `${cleanedBaseUrl}${url}`
      }

      // Handle absolute URLs
      const cleanedUrl = stripDefaultPort(url)
      try {
        const urlOrigin = new URL(cleanedUrl).origin
        const baseOrigin = new URL(cleanedBaseUrl).origin

        // Allow same-origin redirects
        if (urlOrigin === baseOrigin) {
          return cleanedUrl
        }

        // Allow cross-domain redirects to our other allowed domains
        // This enables logout on portreya.com to stay on portreya.com
        // instead of redirecting to teamshotspro.com (NEXTAUTH_URL)
        const urlHostname = new URL(cleanedUrl).hostname.replace(/^www\./, '')
        if ((ALLOWED_DOMAINS as readonly string[]).includes(urlHostname)) {
          return cleanedUrl
        }
      } catch {
        // URL parsing failed - fall back to base
      }

      // Default: redirect to cleaned base URL
      return cleanedBaseUrl
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
