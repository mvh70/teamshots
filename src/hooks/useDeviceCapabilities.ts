import { useEffect, useMemo, useState } from 'react'

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

export function useDeviceCapabilities(): DeviceCapabilities {
  const [state, setState] = useState<DeviceCapabilities>(initialState)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const detect = () => {
      const isIOS =
        IOS_REGEX.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

      const hasTouch =
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        navigator.maxTouchPoints > 0

      const isMobileViewport = window.innerWidth < 768
      const hasCameraApi = Boolean(navigator.mediaDevices?.getUserMedia)
      const prefersNativeCamera = isIOS || !hasCameraApi

      setState({
        isMobile: isMobileViewport,
        isIOSDevice: isIOS,
        hasTouchScreen: hasTouch,
        hasCameraApi,
        preferNativeCamera: prefersNativeCamera,
        isClientReady: true
      })
    }

    detect()

    const handleResize = () => {
      setState(prev => ({
        ...prev,
        isMobile: window.innerWidth < 768
      }))
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return useMemo(() => state, [state])
}

export type UseDeviceCapabilitiesReturn = ReturnType<typeof useDeviceCapabilities>

