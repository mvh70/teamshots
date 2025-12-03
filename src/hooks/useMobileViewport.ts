import { useSyncExternalStore } from 'react'

/**
 * Tailwind's md breakpoint (768px)
 * Used consistently across the app for mobile/desktop detection
 */
export const MOBILE_BREAKPOINT = 768

function getSnapshot(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
}

function getServerSnapshot(): boolean {
  return false
}

function subscribe(callback: () => void): () => void {
  window.addEventListener('resize', callback)
  return () => window.removeEventListener('resize', callback)
}

/**
 * Hook for detecting mobile viewport based on screen width.
 * Uses Tailwind's md breakpoint (768px) as the threshold.
 * 
 * @returns boolean - true if viewport width is less than 768px
 */
export function useMobileViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export default useMobileViewport

