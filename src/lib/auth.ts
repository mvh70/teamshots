// No default import needed here for v5 handler usage in route
import { PrismaAdapter } from "@auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import ResendProvider from "next-auth/providers/resend"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

import type { Session, User } from "next-auth"
import type { AdapterUser } from "next-auth/adapters"
import type { JWT } from "next-auth/jwt"

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
          locale: user.locale,
        }
      }
    }),

    // Magic link authentication
    ResendProvider({
      apiKey: process.env.RESEND_API_KEY!,
      from: process.env.EMAIL_FROM!,
    })
  ],
  
  session: {
    strategy: "jwt" as const,
  },
  
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: User | AdapterUser | null }) {
      if (user) {
        token.role = user.role
        token.locale = user.locale
      }
      return token
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (token) {
        session.user.id = token.sub!
        session.user.role = token.role as string
        session.user.locale = token.locale as string
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
