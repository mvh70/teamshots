import { useState, useEffect } from 'react'
import { useMobileViewport } from './useMobileViewport'

/**
 * Hook to track if the window has been scrolled past a certain threshold.
 * Only active on mobile by default, but can be forced.
 */
export function useScrollThreshold(threshold = 60, forceActive = false) {
  const isMobile = useMobileViewport()
  const [isScrolled, setIsScrolled] = useState(false)
  
  const isActive = isMobile || forceActive

  useEffect(() => {
    if (!isActive) {
      setIsScrolled(true) // Default to "scrolled" (visible) if not active
      return
    }

    const handleScroll = () => {
      if (typeof window === 'undefined') return
      setIsScrolled(window.scrollY > threshold)
    }

    // Initial check
    handleScroll()
    
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isActive, threshold])

  return isScrolled
}

