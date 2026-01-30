'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useState, useEffect, useCallback, useSyncExternalStore, useRef } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useUploadSelfieEndpoints } from '@/hooks/useUploadSelfieEndpoints'
import { useHeartbeat } from '@/hooks/useHeartbeat'
import { useUploadFlow } from '@/hooks/useUploadFlow'
import { useClassificationQueue } from '@/hooks/useClassificationQueue'
import SelfieUploadSuccess from '@/components/Upload/SelfieUploadSuccess'
import StickyUploadBar from '@/components/Upload/StickyUploadBar'
import PhotoUpload from '@/components/Upload/PhotoUpload'
import SelectableGrid from '@/components/generation/selection/SelectableGrid'
import dynamic from 'next/dynamic'
import SelfieInfoOverlayTrigger from '@/components/generation/SelfieInfoOverlayTrigger'
import { preloadFaceDetectionModel } from '@/lib/face-detection'

const SelfieApproval = dynamic(() => import('@/components/Upload/SelfieApproval'), { ssr: false })

interface TokenContext {
  personId: string | null
  firstName: string
  selfieCount: number
  tokenType: 'invite' | 'handoff'
}

interface SelfieItem {
  id: string
  key: string
  url: string
  used?: boolean
  selfieType?: string | null
  selfieTypeConfidence?: number | null
  isProper?: boolean | null
  improperReason?: string | null
  lightingQuality?: string | null
  backgroundQuality?: string | null
}

type OperaWindow = Window & { opera?: string }

const getIsMobileSnapshot = () => {
  if (typeof window === 'undefined') {
    return undefined
  }

  const browserWindow = window as OperaWindow
  const userAgent = navigator.userAgent || navigator.vendor || browserWindow.opera || ''
  const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase())
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  const isMobileViewport = window.innerWidth < 768

  return isMobileUA || (hasTouch && isMobileViewport)
}

const getServerSnapshot = () => undefined
const subscribeToViewport = (callback: () => void) => {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('resize', callback)
  return () => window.removeEventListener('resize', callback)
}

/**
 * Standalone mobile selfie upload page.
 * Works for both invite tokens and handoff tokens.
 * Designed for users who scanned a QR code from desktop.
 */
export default function UploadSelfiePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const t = useTranslations('uploadSelfie')
  const token = params.token as string
  // Handoff token for connection tracking (passed as query param for invite flows)
  const handoffToken = searchParams?.get('handoff') || null

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [context, setContext] = useState<TokenContext | null>(null)
  const [selfies, setSelfies] = useState<SelfieItem[]>([])
  const [showSuccess, setShowSuccess] = useState(false)
  const [pendingSelfieRequests, setPendingSelfieRequests] = useState(0)
  const [cameraKey, setCameraKey] = useState(0)
  const [shouldOpenCamera, setShouldOpenCamera] = useState(false)
  const isMobileDevice = useSyncExternalStore(subscribeToViewport, getIsMobileSnapshot, getServerSnapshot)
  const loadingSelfies = pendingSelfieRequests > 0
  const prevQueueCountRef = useRef<number>(0)

  // Send heartbeat so desktop detects an active mobile session
  useHeartbeat(context ? token : null)

  // Get upload endpoints based on token type (pass tokenType to avoid double validation)
  const { uploadEndpoint, saveEndpoint, isReady } = useUploadSelfieEndpoints(token, context?.tokenType)

  // Classification queue status to show "Analyzing" vs "Queued" states
  // Use handoffToken for handoff flows, token for invite flows
  const classificationQueue = useClassificationQueue({
    token: context?.tokenType === 'invite' ? token : undefined,
    handoffToken: context?.tokenType === 'handoff' ? token : undefined,
  })

  // Load existing selfies based on token type
  const loadSelfies = useCallback(async (tokenType: 'invite' | 'handoff') => {
    setPendingSelfieRequests(count => count + 1)
    try {
      // Use different endpoints based on token type
      const endpoint = tokenType === 'handoff' 
        ? `/api/mobile-handoff/selfies?token=${encodeURIComponent(token)}`
        : `/api/team/member/selfies?token=${encodeURIComponent(token)}`
      
      const response = await fetch(endpoint)
      if (response.ok) {
        const data = await response.json()
        const selfieItems = (data.selfies || []).map((s: SelfieItem & { url?: string }) => ({
          id: s.id,
          key: s.key,
          url: s.url || `/api/files/get?key=${encodeURIComponent(s.key)}&token=${encodeURIComponent(token)}`,
          used: s.used || false,
          selfieType: s.selfieType,
          selfieTypeConfidence: s.selfieTypeConfidence,
          isProper: s.isProper,
          improperReason: s.improperReason,
          lightingQuality: s.lightingQuality,
          backgroundQuality: s.backgroundQuality
        }))
        setSelfies(selfieItems)
      }
    } catch {
      // Silently fail, selfies will just be empty
    } finally {
      setPendingSelfieRequests(count => Math.max(0, count - 1))
    }
  }, [token])

  // Validate token on mount
  useEffect(() => {
    async function validateToken() {
      try {
        // Try handoff token first
        const handoffResponse = await fetch(`/api/mobile-handoff/validate?token=${token}`)
        
        if (handoffResponse.ok) {
          const data = await handoffResponse.json()
          const newContext: TokenContext = {
            personId: data.context.personId,
            firstName: data.context.firstName,
            selfieCount: data.context.selfieCount,
            tokenType: 'handoff'
          }
          setContext(newContext)
          await loadSelfies(newContext.tokenType)
          setLoading(false)
          return
        }

        // If handoff fails, try invite token
        const inviteResponse = await fetch('/api/team/invites/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        })

        if (inviteResponse.ok) {
          const data = await inviteResponse.json()
          const newContext: TokenContext = {
            personId: data.invite?.personId || null,
            firstName: data.invite?.firstName || 'there',
            selfieCount: 0,
            tokenType: 'invite'
          }
          setContext(newContext)
          await loadSelfies(newContext.tokenType)

          // If there's a handoff token for connection tracking, validate it too
          // This updates lastUsedAt so desktop can detect mobile connection
          if (handoffToken) {
            fetch(`/api/mobile-handoff/validate?token=${handoffToken}`).catch(() => {
              // Silently fail - connection tracking is optional
            })
          }

          setLoading(false)
          return
        }

        // Both failed
        const errorData = await handoffResponse.json().catch(() => ({}))
        if (errorData.code === 'EXPIRED') {
          setError(t('errors.tokenExpired'))
        } else {
          setError(t('errors.invalidToken'))
        }
        setLoading(false)
      } catch {
        setError(t('errors.validationFailed'))
        setLoading(false)
      }
    }

    validateToken()
  }, [token, t, loadSelfies])

  // Preload face detection model immediately when page loads
  useEffect(() => {
    console.log('[UploadSelfiePage] Preloading face detection model...')
    preloadFaceDetectionModel()
  }, [])

  // Auto-reload selfies when classification queue empties (classification completed)
  useEffect(() => {
    if (!classificationQueue || !context) return

    const currentQueueCount = (classificationQueue.activeSelfieIds?.length || 0) + (classificationQueue.queuedSelfieIds?.length || 0)
    const prevCount = prevQueueCountRef.current
    prevQueueCountRef.current = currentQueueCount

    // If queue went from non-empty to empty, classification just finished - reload selfies
    if (prevCount > 0 && currentQueueCount === 0) {
      console.log('[UploadSelfiePage] Classification queue emptied, reloading selfies...')
      loadSelfies(context.tokenType)
    }
  }, [classificationQueue, context, loadSelfies])

  const handleSelfiesApproved = useCallback(async (results: { key: string; selfieId?: string }[]) => {
    setShowSuccess(true)

    // Auto-select newly uploaded selfies
    for (const result of results) {
      if (result.selfieId) {
        try {
          const qs = token ? `?token=${encodeURIComponent(token)}` : ''
          await fetch(`/api/selfies/${result.selfieId}/select${qs}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ selected: true, token }),
            credentials: 'include'
          })
        } catch (error) {
          console.error('Failed to auto-select selfie:', error)
        }
      }
    }

    // Reload selfies to show the new ones
    if (context) {
      await loadSelfies(context.tokenType)
    }

    // Reset success state after a delay
    setTimeout(() => {
      setShowSuccess(false)
    }, 2000)
  }, [loadSelfies, context, token])

  const handleUploadError = useCallback((error: string) => {
    setError(error)
  }, [])

  // Upload flow state management for PhotoUpload
  const {
    isProcessing,
    uploadFile,
    handleUploadResult,
    pendingApproval,
    approvePending,
    cancelPending,
    retakePending
  } = useUploadFlow({
    uploadEndpoint,
    saveEndpoint,
    onApproved: handleSelfiesApproved,
    onError: handleUploadError
  })


  // Handle camera auto-open for retakes
  useEffect(() => {
    if (!shouldOpenCamera) return
    const timer = setTimeout(() => {
      setShouldOpenCamera(false)
    }, 1000)
    return () => clearTimeout(timer)
  }, [shouldOpenCamera])

  // Custom retake handler that reopens camera
  const handleRetake = useCallback(() => {
    retakePending()
    setCameraKey(prev => prev + 1)
    setShouldOpenCamera(true)
  }, [retakePending])

  // Check mobile device (wait for client-side check)
  if (isMobileDevice === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-brand-primary animate-spin mx-auto" />
          <p className="mt-3 text-sm text-gray-600">{t('loading')}</p>
        </div>
      </div>
    )
  }

  // Show error if accessed from desktop
  if (!isMobileDevice) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-blue-500" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            {t('errors.desktopAccess.title')}
          </h1>
          <p className="text-gray-600 mb-6">
            {t('errors.desktopAccess.message')}
          </p>
          <p className="text-sm text-gray-500">
            {t('errors.desktopAccess.hint')}
          </p>
        </div>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-brand-primary animate-spin mx-auto" />
          <p className="mt-3 text-sm text-gray-600">{t('loading')}</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !context) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            {t('errors.title')}
          </h1>
          <p className="text-gray-600 mb-6">
            {error || t('errors.invalidToken')}
          </p>
          <p className="text-sm text-gray-500">
            {t('errors.scanNewQR')}
          </p>
        </div>
      </div>
    )
  }

  // Wait for endpoints to be ready
  if (!isReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
      </div>
    )
  }

  // Show approval flow if pending
  if (pendingApproval) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        {/* Simple header with logo only */}
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-center">
            <Image
              src="/branding/teamshotspro_trans.webp"
              alt="TeamShotsPro"
              width={150}
              height={23}
              className="h-8 w-auto"
              priority
            />
          </div>
        </header>

        {/* Approval component */}
        <div className="flex-1 flex items-center justify-center p-4">
          <SelfieApproval
            photoKey={pendingApproval.key}
            previewUrl={pendingApproval.previewUrl}
            onApprove={approvePending}
            onRetake={handleRetake}
            onCancel={cancelPending}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Simple header with logo only */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-center">
          <Image
            src="/branding/teamshotspro_trans.webp"
            alt="TeamShotsPro"
            width={150}
            height={23}
            className="h-8 w-auto"
            priority
          />
        </div>
      </header>

      {/* Greeting */}
      <div className="px-4 py-4 bg-gray-50 border-b border-gray-100">
        <h1 className="text-lg font-semibold text-gray-900">
          {t('greeting', { name: context.firstName })}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {t('subtitle')}
        </p>
        <div className="mt-3">
          <SelfieInfoOverlayTrigger dense className="w-full" />
        </div>
      </div>

      {/* Success banner */}
      {showSuccess && (
        <div className="px-4 py-3 bg-green-50 border-b border-green-100">
          <SelfieUploadSuccess className="border-0 shadow-none p-0" />
        </div>
      )}

      {/* Main content - selfie grid */}
      <div className="flex-1 px-4 py-4 pb-48">
        {loadingSelfies ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        ) : (
          <SelectableGrid
            items={selfies.map(selfie => ({
              id: selfie.id,
              key: selfie.key,
              url: selfie.url,
              uploadedAt: undefined,
              used: selfie.used || false,
              selfieType: selfie.selfieType ?? undefined,
              selfieTypeConfidence: selfie.selfieTypeConfidence ?? undefined,
              isProper: selfie.isProper ?? undefined,
              improperReason: selfie.improperReason ?? undefined,
              lightingQuality: selfie.lightingQuality ?? undefined,
              backgroundQuality: selfie.backgroundQuality ?? undefined
            }))}
            selection={{
              mode: 'managed',
              token: token,
              onAfterChange: async () => {
                // Reload selfies to refresh selection state
                await loadSelfies(context.tokenType)
              }
            }}
            token={token}
            allowDelete={true}
            onDeleted={async () => {
              // Reload selfies after deletion
              if (context) {
                await loadSelfies(context.tokenType)
              }
            }}
            showUploadTile={false}
            showLoadingState={true}
            classificationQueue={classificationQueue}
          />
        )}
      </div>

      {/* Sticky upload buttons at bottom - using reusable StickyUploadBar + PhotoUpload */}
      {!showSuccess && isReady && !pendingApproval && (
        <StickyUploadBar>
          <PhotoUpload
            key={cameraKey}
            multiple={true}
            autoOpenCamera={shouldOpenCamera}
            onUpload={async (file, meta) => {
              console.log('[MobileUpload] uploadFile called with:', file.name, meta)
              const result = await uploadFile(file, meta)
              console.log('[MobileUpload] uploadFile result:', result)
              return result
            }}
            onUploaded={(result, meta) => {
              console.log('[MobileUpload] handleUploadResult called with:', result, meta)
              handleUploadResult(result)
            }}
            isProcessing={isProcessing}
            onCameraError={handleUploadError}
            buttonLayout="horizontal"
            hidePlusIcon={true}
          />
        </StickyUploadBar>
      )}

      {/* Bottom info section */}
      <div className="fixed bottom-[90px] left-0 right-0 z-40 px-4 pointer-events-none">
        <div className="text-center">
          <p className="text-xs text-gray-500 bg-white/90 backdrop-blur-sm rounded-lg py-2 px-4 inline-block">
            {t('doneHint')}
          </p>
        </div>
      </div>
    </div>
  )
}
