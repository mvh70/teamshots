'use client'

import { SessionProvider as NextAuthSessionProvider, useSession } from 'next-auth/react'
import type { Session } from 'next-auth'
import { useEffect } from 'react'
import { posthog } from '@/lib/posthog'
import { ApolloTracking } from '@/components/ApolloTracking'

function PostHogUserIdentifier() {
  const { data: session } = useSession()

  useEffect(() => {
    if (session?.user && posthog.__loaded) {
      // Identify user in PostHog
      posthog.identify(session.user.id, {
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
      })
    } else if (!session && posthog.__loaded) {
      // Reset PostHog when user logs out
      posthog.reset()
    }
  }, [session])

  return null
}

export default function SessionProvider({
  children,
  session,
}: {
  children: React.ReactNode
  session?: Session | null
}) {
  return (
    <NextAuthSessionProvider 
      session={session}
      refetchInterval={5 * 60} // Check session every 5 minutes during activity
      refetchOnWindowFocus={false} // Avoid burst of extra calls on focus
    >
      <PostHogUserIdentifier />
      <ApolloTracking />
      {children}
    </NextAuthSessionProvider>
  )
}
