import { useEffect, useState } from 'react'

/**
 * Tailwind's md breakpoint (768px)
 * Used consistently across the app for mobile/desktop detection
 */
export const MOBILE_BREAKPOINT = 768

/**
 * Hook for detecting mobile viewport based on screen width.
 * Uses Tailwind's md breakpoint (768px) as the threshold.
 * 
 * @returns boolean - true if viewport width is less than 768px
 */
export function useMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return isMobile
}

export default useMobileViewport

