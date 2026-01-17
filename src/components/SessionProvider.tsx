'use client'

import { SessionProvider as NextAuthSessionProvider, useSession } from 'next-auth/react'
import type { Session } from 'next-auth'
import { useEffect, useRef } from 'react'
import { posthog } from '@/lib/posthog'
import { ApolloTracking } from '@/components/ApolloTracking'

function PostHogUserIdentifier() {
  const { data: session } = useSession()
  const lastIdentifiedUserRef = useRef<string | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Cleanup debounce timer on unmount
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    // Debounce identify calls to prevent rapid-fire during session transitions
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      if (session?.user && posthog.__loaded) {
        // Only identify if user changed to prevent duplicate calls
        if (lastIdentifiedUserRef.current !== session.user.id) {
          posthog.identify(session.user.id, {
            email: session.user.email,
            name: session.user.name,
            image: session.user.image,
          })
          lastIdentifiedUserRef.current = session.user.id
        }
      } else if (!session && posthog.__loaded && lastIdentifiedUserRef.current) {
        // Reset PostHog when user logs out
        posthog.reset()
        lastIdentifiedUserRef.current = null
      }
    }, 100) // 100ms debounce
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
