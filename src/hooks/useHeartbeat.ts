import { useEffect, useRef } from 'react'

const HEARTBEAT_INTERVAL_MS = 5_000

/**
 * Sends periodic heartbeat pings to /api/mobile-heartbeat so the desktop
 * can detect whether the mobile browser tab is still open.
 */
export function useHeartbeat(token: string | null) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!token) return

    const sendHeartbeat = () => {
      fetch(`/api/mobile-heartbeat?token=${encodeURIComponent(token)}`, {
        method: 'POST'
      }).catch(() => {
        // Silently ignore — heartbeat is best-effort
      })
    }

    // Send immediately, then every 5s
    sendHeartbeat()
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [token])
}
