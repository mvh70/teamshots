'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useTranslations } from 'next-intl'
import { Smartphone, RefreshCw, Check, Loader2 } from 'lucide-react'
import { getCleanClientBaseUrl } from '@/lib/url'

interface MobileHandoffQRProps {
  /** For invite users - use existing invite token */
  inviteToken?: string
  /** Optional callback when mobile device connects */
  onMobileConnected?: () => void
  /** Optional callback when selfie is uploaded from mobile */
  onSelfieUploaded?: () => void
  /** Custom class name */
  className?: string
  /** Size of the QR code */
  size?: number
  /** Whether to show as a compact placeholder */
  compact?: boolean
}

interface HandoffState {
  token: string | null
  qrUrl: string | null
  expiresAt: Date | null
  loading: boolean
  error: string | null
  deviceConnected: boolean
  lastSelfieCount: number
}

const POLL_INTERVAL = 2000 // 2 seconds

export default function MobileHandoffQR({
  inviteToken,
  onMobileConnected,
  onSelfieUploaded,
  className = '',
  size = 160,
  compact = false
}: MobileHandoffQRProps) {
  const t = useTranslations('mobileHandoff')
  const [state, setState] = useState<HandoffState>({
    token: inviteToken || null,
    qrUrl: inviteToken ? null : null, // Will be set after token creation
    expiresAt: null,
    loading: !inviteToken, // Only loading if we need to create a token
    error: null,
    deviceConnected: false,
    lastSelfieCount: 0
  })
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const previousDeviceConnected = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const hasSyncedRef = useRef(false)

  // Create handoff token for logged-in users
  const createToken = useCallback(async () => {
    if (inviteToken) {
      // For invite users, construct the URL directly
      // Use clean base URL to avoid :80 port from reverse proxy headers
      const baseUrl = getCleanClientBaseUrl()
      setState(prev => ({
        ...prev,
        qrUrl: `${baseUrl}/upload-selfie/${inviteToken}`,
        loading: false
      }))
      return
    }

    // Only show full loading state if we don't have a QR code yet
    setState(prev => ({ 
      ...prev, 
      loading: !prev.qrUrl, 
      error: null 
    }))
    
    try {
      const response = await fetch('/api/mobile-handoff/create', {
        method: 'POST',
        credentials: 'include'
      })
      
      if (!response.ok) {
        throw new Error('Failed to create handoff token')
      }
      
      const data = await response.json()
      
      // Reset sync state for new token
      hasSyncedRef.current = false
      
      setState(prev => ({
        ...prev,
        token: data.token,
        qrUrl: data.qrUrl,
        expiresAt: new Date(data.expiresAt),
        loading: false,
        error: null,
        // Reset device connected state for new token
        deviceConnected: false,
        lastSelfieCount: 0
      }))
      
      // Reset connection tracking
      previousDeviceConnected.current = false
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to create QR code'
      }))
    }
  }, [inviteToken])

  // Poll for status updates
  const pollStatus = useCallback(async () => {
    if (!state.token || inviteToken) return // Don't poll for invite tokens

    try {
      const response = await fetch(`/api/mobile-handoff/status?token=${state.token}`, {
        credentials: 'include',
        signal: abortControllerRef.current?.signal
      })

      if (!response.ok) {
        console.warn('[MobileHandoffQR] Poll status failed:', response.status, response.statusText)
        return
      }

      const data = await response.json()

      // Only update state if not aborted
      if (!abortControllerRef.current?.signal.aborted) {
        // Handle first sync
        const isFirstSync = !hasSyncedRef.current
        if (isFirstSync) hasSyncedRef.current = true

        setState(prev => {
          let hasChanges = false
          const newState = { ...prev }

          // Check if device connection status changed
          if (data.deviceConnected !== prev.deviceConnected) {
            newState.deviceConnected = data.deviceConnected
            hasChanges = true
            
            // Trigger callback if just connected
            if (data.deviceConnected && !previousDeviceConnected.current) {
              onMobileConnected?.()
            }
          }
          previousDeviceConnected.current = data.deviceConnected

          // Check if selfie count increased
          const currentCount = data.selfieCount ?? 0

          if (isFirstSync) {
            if (currentCount !== prev.lastSelfieCount) {
              newState.lastSelfieCount = currentCount
              hasChanges = true
            }
          } else {
            if (currentCount > prev.lastSelfieCount) {
              onSelfieUploaded?.()
              newState.lastSelfieCount = currentCount
              hasChanges = true
            } else if (currentCount !== prev.lastSelfieCount) {
              // Sync count if it changed (e.g. decreased or initial load)
              newState.lastSelfieCount = currentCount
              hasChanges = true
            }
          }

          // Check if token expired - trigger refresh
          if (!data.valid) {
            // Trigger token refresh immediately
            // We don't clear state here to avoid UI flash - createToken will replace it
            createToken()
            return prev
          }

          return hasChanges ? newState : prev
        })
      }
    } catch (error) {
      // Only log if not aborted (abort is expected on unmount)
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('[MobileHandoffQR] Poll status error:', error)
      }
    }
  }, [state.token, inviteToken, onMobileConnected, onSelfieUploaded, createToken])

  // Initialize token and start polling
  useEffect(() => {
    // Create abort controller for this component lifecycle
    abortControllerRef.current = new AbortController()

    createToken()

    return () => {
      // Abort any pending requests
      abortControllerRef.current?.abort()

      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [createToken])

  // Start/stop polling based on token availability
  useEffect(() => {
    if (state.token && !inviteToken) {
      pollIntervalRef.current = setInterval(pollStatus, POLL_INTERVAL)
      // Initial poll
      pollStatus()
    }
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [state.token, inviteToken, pollStatus])

  // Calculate time remaining
  const getTimeRemaining = () => {
    if (!state.expiresAt) return null
    const remaining = state.expiresAt.getTime() - Date.now()
    if (remaining <= 0) return null
    const minutes = Math.floor(remaining / 60000)
    const seconds = Math.floor((remaining % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Compact placeholder version (for selfie grid)
  if (compact) {
    return (
      <div 
        className={`relative flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-dashed border-blue-200 rounded-xl p-4 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all ${className}`}
        onClick={createToken}
      >
        {state.loading ? (
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        ) : state.qrUrl ? (
          <>
            <div className="relative">
              <QRCodeSVG
                value={state.qrUrl}
                size={size}
                level="M"
                includeMargin={false}
                className="rounded"
              />
              {state.deviceConnected && (
                <div className="absolute -top-2 -right-2 bg-green-500 rounded-full p-1">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-blue-600 font-medium">
              <Smartphone className="w-3.5 h-3.5" />
              <span>{t('scanToUpload')}</span>
            </div>
          </>
        ) : state.error ? (
          <div className="text-center">
            <RefreshCw className="w-6 h-6 text-gray-400 mx-auto mb-2" />
            <span className="text-xs text-gray-500">{t('tapToRetry')}</span>
          </div>
        ) : null}
      </div>
    )
  }

  // Full version with more details
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-6 ${className}`}>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {t('title')}
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          {t('description')}
        </p>
        
        <div className="flex justify-center mb-4">
          {state.loading ? (
            <div className="flex items-center justify-center w-[200px] h-[200px] bg-gray-50 rounded-lg">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : state.qrUrl ? (
            <div className="relative p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <QRCodeSVG
                value={state.qrUrl}
                size={180}
                level="M"
                includeMargin={false}
              />
              {state.deviceConnected && (
                <div className="absolute -top-2 -right-2 bg-green-500 rounded-full p-1.5 shadow-md">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          ) : state.error ? (
            <div className="flex flex-col items-center justify-center w-[200px] h-[200px] bg-red-50 rounded-lg">
              <p className="text-sm text-red-600 mb-2">{state.error}</p>
              <button
                onClick={createToken}
                className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                {t('retry')}
              </button>
            </div>
          ) : null}
        </div>
        
        {state.deviceConnected && (
          <div className="flex items-center justify-center gap-2 text-green-600 mb-3">
            <Check className="w-4 h-4" />
            <span className="text-sm font-medium">{t('phoneConnected')}</span>
          </div>
        )}
        
        {state.expiresAt && !inviteToken && (
          <p className="text-xs text-gray-500">
            {t('expiresIn', { time: getTimeRemaining() || '0:00' })}
          </p>
        )}
        
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            {t('howToScan')}
          </p>
        </div>
      </div>
    </div>
  )
}

