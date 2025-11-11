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
        console.log('🔐 NextAuth authorize called with:', { 
          email: credentials?.email, 
          hasPassword: !!credentials?.password,
          databaseUrl: Env.string('DATABASE_URL'),
          nodeEnv: Env.string('NODE_ENV')
        });
        
        // Check what database the prisma client is actually using
        console.log('🗄️ Prisma client database URL:', Env.string('DATABASE_URL'));

        if (!credentials?.email || !credentials?.password) {
          console.log('❌ Missing credentials');
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string }
        })

        console.log('🔍 User lookup result:', { 
          found: !!user, 
          hasPassword: !!user?.password,
          userId: user?.id,
          userEmail: user?.email 
        });

        if (!user || !user.password) {
          console.log('❌ User not found or no password');
          return null
        }

        const password = credentials.password as string
        const userPasswordHash = user.password as string
        const isPasswordValid = await bcrypt.compare(password, userPasswordHash)
        console.log('🔐 Password verification:', { isValid: isPasswordValid });
        
        if (!isPasswordValid) {
          console.log('❌ Invalid password');
          return null
        }

        console.log('✅ Authentication successful');
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

  // Add cookie configuration for security - Safari-compatible
  cookies: {
    sessionToken: {
      name: `${Env.string('NODE_ENV') === 'production' ? '__Secure-' : ''}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: Env.string('NODE_ENV') === 'production'
      }
    },
    callbackUrl: {
      name: `${Env.string('NODE_ENV') === 'production' ? '__Secure-' : ''}next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: Env.string('NODE_ENV') === 'production'
      }
    },
    csrfToken: {
      name: `${Env.string('NODE_ENV') === 'production' ? '__Host-' : ''}next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
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
        
        try {
          // Pull person data if linked
          const person = await prisma.person.findUnique({
            where: { userId: user.id },
            include: {
              team: {
                select: { id: true, name: true, adminId: true }
              }
            }
          })
          if (person) {
            token.person = {
              id: person.id,
              firstName: person.firstName,
              lastName: person.lastName,
              teamId: person.teamId,
              team: person.team
            }
            token.givenName = person.firstName
          }
        } catch {}
        
        // Set token expiration time when user first authenticates
        const now = Math.floor(Date.now() / 1000)
        token.exp = now + SESSION_MAX_AGE_SECONDS
      }
      
      
      // On subsequent requests, ensure we hydrate person data if missing
      if (!token.person && token.sub) {
        try {
          const person = await prisma.person.findUnique({
            where: { userId: token.sub },
            include: {
              team: {
                select: { id: true, name: true, adminId: true }
              }
            }
          })
          if (person) {
            token.person = {
              id: person.id,
              firstName: person.firstName,
              lastName: person.lastName,
              teamId: person.teamId,
              team: person.team
            }
            token.givenName = person.firstName
          }
        } catch {}
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
