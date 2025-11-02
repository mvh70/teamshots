import { DefaultSession, DefaultUser } from "next-auth"

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      role: string
      isAdmin: boolean
      locale: string
      impersonating?: boolean
      originalUserId?: string
      person?: {
        id: string
        firstName: string
        lastName?: string | null
        teamId?: string | null
        team?: {
          id: string
          name: string
          adminId: string
        } | null
      } | null
    }
  }

  interface User extends DefaultUser {
    id: string
    email: string
    name?: string | null
    image?: string | null
    role: string
    isAdmin: boolean
    locale: string
    person?: {
      id: string
      firstName: string
      lastName?: string | null
      teamId?: string | null
      team?: {
        id: string
        name: string
      } | null
    } | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string
    isAdmin: boolean
    locale: string
    givenName?: string
    impersonating?: boolean
    originalUserId?: string
    person?: {
      id: string
      firstName: string
      lastName?: string | null
      teamId?: string | null
      team?: {
        id: string
        name: string
      } | null
    } | null
  }
}
