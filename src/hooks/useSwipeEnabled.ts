import { useMemo } from 'react'
import { useMobileViewport } from './useMobileViewport'
import { useDeviceCapabilities } from './useDeviceCapabilities'

/**
 * Hook that determines if swipe navigation should be enabled.
 * 
 * Swipe is only enabled when:
 * 1. Viewport is mobile (< 768px)
 * 2. Device has touch capability
 * 
 * This ensures swipe only works on actual touch-enabled mobile devices,
 * not desktop browsers with small windows.
 * 
 * @returns boolean - true if swipe should be enabled
 */
export function useSwipeEnabled(): boolean {
  const isMobile = useMobileViewport()
  const { hasTouchScreen, isClientReady } = useDeviceCapabilities()

  return useMemo(() => {
    // Wait for client-side detection to complete
    if (!isClientReady) {
      return false
    }
    
    // Swipe only enabled on mobile viewport with touch capability
    return isMobile && hasTouchScreen
  }, [isMobile, hasTouchScreen, isClientReady])
}

export default useSwipeEnabled

