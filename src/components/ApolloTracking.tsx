'use client'

import { useSession } from "next-auth/react"
import { useEffect } from "react"

export function ApolloTracking() {
  const { data: session } = useSession()

  useEffect(() => {
    // Only try to identify if we have a user
    if (!session?.user?.email) return

    // Poll for zenalytics availability
    const checkZenalytics = setInterval(() => {
      // @ts-ignore - zenalytics is injected globally by Apollo script
      if (typeof window !== 'undefined' && window.zenalytics && window.zenalytics.identify) {
        try {
          // @ts-ignore
          window.zenalytics.identify(session.user.id || session.user.email, {
            email: session.user.email,
            name: session.user.name,
            signupDomain: session.user.signupDomain
          })
          // Once identified, we can stop checking
          clearInterval(checkZenalytics)
        } catch (e) {
          console.warn('Apollo identify failed', e)
        }
      }
    }, 1000)

    // Stop checking after 30 seconds to avoid infinite polling
    const timeout = setTimeout(() => {
      clearInterval(checkZenalytics)
    }, 30000)

    return () => {
      clearInterval(checkZenalytics)
      clearTimeout(timeout)
    }
  }, [session])

  return null
}

