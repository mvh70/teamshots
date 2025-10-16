import { DefaultSession, DefaultUser } from "next-auth"

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      role: string
      locale: string
    }
  }

  interface User extends DefaultUser {
    id: string
    email: string
    name?: string | null
    image?: string | null
    role: string
    locale: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string
    locale: string
  }
}
