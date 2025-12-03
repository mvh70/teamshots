import { useCallback, useSyncExternalStore } from 'react'

const IOS_REGEX = /iPad|iPhone|iPod/

interface DeviceCapabilities {
  isMobile: boolean
  isIOSDevice: boolean
  hasTouchScreen: boolean
  hasCameraApi: boolean
  preferNativeCamera: boolean
  isClientReady: boolean
}

const initialState: DeviceCapabilities = {
  isMobile: false,
  isIOSDevice: false,
  hasTouchScreen: false,
  hasCameraApi: false,
  preferNativeCamera: false,
  isClientReady: false
}

function getDeviceCapabilities(): DeviceCapabilities {
  if (typeof window === 'undefined') return initialState

  const isIOS =
    IOS_REGEX.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  const hasTouch =
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0

  const isMobileViewport = window.innerWidth < 768
  const hasCameraApi = Boolean(navigator.mediaDevices?.getUserMedia)
  const prefersNativeCamera = isIOS || !hasCameraApi

  return {
    isMobile: isMobileViewport,
    isIOSDevice: isIOS,
    hasTouchScreen: hasTouch,
    hasCameraApi,
    preferNativeCamera: prefersNativeCamera,
    isClientReady: true
  }
}

function subscribe(callback: () => void): () => void {
  window.addEventListener('resize', callback)
  return () => window.removeEventListener('resize', callback)
}

function getServerSnapshot(): DeviceCapabilities {
  return initialState
}

export function useDeviceCapabilities(): DeviceCapabilities {
  const getSnapshot = useCallback(() => getDeviceCapabilities(), [])
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export type UseDeviceCapabilitiesReturn = ReturnType<typeof useDeviceCapabilities>

