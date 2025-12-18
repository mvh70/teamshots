'use client'

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useTranslations } from 'next-intl'
import { RefreshCw, CheckCircle, Loader2 } from 'lucide-react'

interface QRPlaceholderProps {
  /** For invite users - use existing invite token */
  inviteToken?: string
  /** Size of the QR code */
  size?: number
  /** Custom class name */
  className?: string
  /** Callback when selfie is uploaded from mobile */
  onSelfieUploaded?: () => void
}

const POLL_INTERVAL = 2000
const REFRESH_BEFORE_EXPIRY = 60000

const subscribeMobile = (callback: () => void) => {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('resize', callback)
  return () => window.removeEventListener('resize', callback)
}

const getMobileSnapshot = () => {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(max-width: 768px)').matches
}

const getMobileServerSnapshot = () => false

/**
 * QR code placeholder that can be displayed in a selfie grid.
 * Shows a QR code for mobile selfie upload.
 * Hidden on mobile devices.
 */
export default function QRPlaceholder({
  inviteToken,
  size = 120,
  className = '',
  onSelfieUploaded
}: QRPlaceholderProps) {
  const t = useTranslations('mobileHandoff')
  
  const [token, setToken] = useState<string | null>(null)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deviceConnected, setDeviceConnected] = useState(false)
  const [lastSelfieCount, setLastSelfieCount] = useState(0)
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const onSelfieUploadedRef = useRef(onSelfieUploaded)
  const initRef = useRef(false)
  const hasSyncedRef = useRef(false)
  
  // Keep ref in sync with prop
  useEffect(() => {
    onSelfieUploadedRef.current = onSelfieUploaded
  }, [onSelfieUploaded])

  // Create or set token
  const createToken = useCallback(async () => {
    if (inviteToken) {
      const baseUrl = window.location.origin
      setQrUrl(`${baseUrl}/upload-selfie/${inviteToken}`)
      setLoading(false)
      return
    }

    // Only set loading if we don't have a QR code yet
    if (!qrUrl) {
      setLoading(true)
    }
    setError(null)

    try {
      const response = await fetch('/api/mobile-handoff/create', {
        method: 'POST',
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to create QR code')
      }

      const data = await response.json()

      setToken(data.token)
      setQrUrl(data.qrUrl)
      setLoading(false)
      // Reset selfie count tracking for new token
      setLastSelfieCount(0)
      hasSyncedRef.current = false

      // Store token in sessionStorage for persistence across refreshes
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('mobileHandoffToken', JSON.stringify({
            token: data.token,
            qrUrl: data.qrUrl,
            expiresAt: data.expiresAt
          }))
        } catch {
          // Ignore storage errors
        }
      }

      // Schedule refresh before expiry
      const expiryTime = new Date(data.expiresAt).getTime()
      const refreshIn = expiryTime - Date.now() - REFRESH_BEFORE_EXPIRY
      if (refreshIn > 0) {
        refreshTimeoutRef.current = setTimeout(createToken, refreshIn)
      }
    } catch {
      setLoading(false)
      setError(t('errors.createFailed'))
    }
  }, [inviteToken, t, qrUrl])

  // Poll for status updates (logged-in users only)
  const pollStatus = useCallback(async () => {
    if (!token || inviteToken) return

    try {
      const response = await fetch(`/api/mobile-handoff/status?token=${token}`, {
        credentials: 'include'
      })

      if (!response.ok) {
        // If unauthorized or token not found, clear and recreate
        if (response.status === 401 || response.status === 404) {
          // Don't clear state immediately to avoid flash
          
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.removeItem('mobileHandoffToken')
            } catch {
              // Ignore storage errors
            }
          }
          initRef.current = false
          void createToken()
        }
        return
      }

      const data = await response.json()

      // Update device connection state
      if (deviceConnected !== !!data.deviceConnected) {
        setDeviceConnected(!!data.deviceConnected)
      }

      const currentCount = data.selfieCount ?? 0

      // Handle initial sync vs updates
      if (!hasSyncedRef.current) {
        setLastSelfieCount(currentCount)
        hasSyncedRef.current = true
      } else {
        // Check if selfie count increased (new selfie uploaded)
        if (currentCount > lastSelfieCount) {
          onSelfieUploadedRef.current?.()
          setLastSelfieCount(currentCount)
        } else if (currentCount !== lastSelfieCount) {
          // Sync count if it changed (e.g. decreased)
          setLastSelfieCount(currentCount)
        }
      }

      // Check if token expired or invalid
      if (data.valid === false || data.expired === true) {
        // Don't clear state immediately to avoid flash
        
        // Clear stored token
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.removeItem('mobileHandoffToken')
          } catch {
            // Ignore storage errors
          }
        }
        initRef.current = false
        void createToken()
      }
    } catch {
      // Silently fail polling
    }
  }, [token, inviteToken, createToken, deviceConnected, lastSelfieCount])

  // Initialize - restore from storage or create new token
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    // Handle invite token mode
    if (inviteToken) {
      const baseUrl = window.location.origin
      setQrUrl(`${baseUrl}/upload-selfie/${inviteToken}`)
      setLoading(false)
      return
    }

    // Try to restore token from sessionStorage
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('mobileHandoffToken')
        if (stored) {
          const parsed = JSON.parse(stored)
          // Check if token is still valid (not expired)
          if (parsed.token && parsed.expiresAt && new Date(parsed.expiresAt) > new Date()) {
            setToken(parsed.token)
            setQrUrl(parsed.qrUrl)
            setLoading(false)
            return
          } else {
            sessionStorage.removeItem('mobileHandoffToken')
          }
        }
      } catch {
        try {
          sessionStorage.removeItem('mobileHandoffToken')
        } catch {
          // Ignore
        }
      }
    }

    // No valid stored token, create new one
    createToken()
  }, [inviteToken, createToken])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current)
    }
  }, [])

  // Start polling for device connection status and selfie count
  useEffect(() => {
    if (token && !inviteToken) {
      pollIntervalRef.current = setInterval(pollStatus, POLL_INTERVAL)
      pollStatus()
    }
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [token, inviteToken, pollStatus])

  // Hide on mobile/touch devices
  const isMobile = useSyncExternalStore(subscribeMobile, getMobileSnapshot, getMobileServerSnapshot)

  if (isMobile) return null

  return (
    <div 
      className={`relative aspect-square flex flex-col items-center justify-center bg-gradient-to-br from-white via-gray-50 to-gray-100 border border-gray-200 rounded-xl cursor-pointer hover:shadow-lg transition-all p-3 ${className}`}
      onClick={error ? createToken : undefined}
    >
      {loading ? (
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      ) : qrUrl ? (
        <>
          <h3 className="text-base font-semibold text-gray-900 text-center mb-3">
            {t('scanToUsePhone')}
          </h3>
          <div className="relative flex-1 flex items-center justify-center w-full">
            <QRCodeSVG
              value={qrUrl}
              size={size}
              level="M"
              includeMargin={false}
              className="rounded max-w-full max-h-full"
              style={{ width: '75%', height: 'auto' }}
            />
            {deviceConnected && (
              <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-1 shadow-sm">
                <CheckCircle className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
          {deviceConnected && (
            <span className="mt-1 text-xs text-green-600">{t('phoneConnected')}</span>
          )}
        </>
      ) : error ? (
        <div className="text-center p-2">
          <RefreshCw className="w-6 h-6 text-gray-400 mx-auto mb-2" />
          <span className="text-xs text-gray-500">{t('tapToRetry')}</span>
        </div>
      ) : null}
    </div>
  )
}

