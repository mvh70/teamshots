'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import SelfieGallery from '@/components/generation/SelfieGallery'
import dynamic from 'next/dynamic'
import InviteDashboardHeader from '@/components/invite/InviteDashboardHeader'
import { ErrorBanner } from '@/components/ui'
import { useSelfieManagement } from '@/hooks/useSelfieManagement'
import SelfieSelectionInfoBanner from '@/components/generation/SelfieSelectionInfoBanner'
import SelfieUploadSuccess from '@/components/Upload/SelfieUploadSuccess'

const SelfieUploadFlow = dynamic(() => import('@/components/Upload/SelfieUploadFlow'), { ssr: false })

interface Selfie {
  id: string
  key: string
  url: string
  uploadedAt: string
  status: 'pending' | 'approved' | 'rejected'
  used?: boolean
}

export default function SelfiesPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = params.token as string
  const uploadOnly = (searchParams?.get('mode') || '') === 'upload'

  const [error, setError] = useState<string | null>(null)
  
  // Upload flow state
  const [showUploadFlow, setShowUploadFlow] = useState(false)
  const [isApproved, setIsApproved] = useState<boolean>(false)
  // Header resolves invite info internally; no local invite state needed

  // Custom uploader that passes the invite token to the proxy so uploads work without a session
  const onUploadWithToken = async (file: File): Promise<{ key: string; url?: string }> => {
    const ext = file.name.split('.')?.pop()?.toLowerCase() || ''
    const res = await fetch(`/api/uploads/proxy?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: {
        'x-file-content-type': file.type,
        'x-file-extension': ext,
        'x-file-type': 'selfie'
      },
      body: file,
      credentials: 'include'
    })
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      throw new Error(errorData.error || 'Upload failed')
    }
    const { key } = await res.json() as { key: string }
    // Provide a local preview url for UX
    const preview = URL.createObjectURL(file)
    return { key, url: preview }
  }

  // Custom save endpoint that creates DB record for invite flow
  const saveSelfieEndpoint = async (key: string): Promise<string | undefined> => {
    const response = await fetch('/api/team/member/selfies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        selfieKey: key
      }),
      credentials: 'include'
    })

    if (!response.ok) {
      throw new Error('Failed to save selfie')
    }

    const data = await response.json() as { selfie?: { id: string } }
    return data.selfie?.id
  }

  // Multi-select: load and manage selected selfies
  const { uploads: hookSelfies, selectedIds, loading, loadSelected, handlePhotoUpload, handleSelfiesApproved } = useSelfieManagement({
    token,
    inviteMode: true,
    customUploadEndpoint: onUploadWithToken,
    customSaveEndpoint: saveSelfieEndpoint,
    autoSelectNewUploads: true,
    onSelfiesApproved: () => {
      // Handle navigation and approval state for invited flow
      // Only navigate away if in upload-only mode
      if (uploadOnly) {
        router.push(`/invite-dashboard/${token}`)
        return
      }

      // Show success briefly, then handle mobile/desktop differences
      setIsApproved(true)

      // On mobile in generation flow, keep upload flow open after approval
      if (isMobile && isInGenerationFlow) {
        // Keep upload flow open but clear approval state after delay
        setTimeout(() => {
          setIsApproved(false)
          // Upload flow stays open (showUploadFlow remains true)
        }, 1500)
      } else {
        // Desktop or non-generation flow: close upload flow after success
        setTimeout(() => {
          setShowUploadFlow(false)
          setIsApproved(false)
        }, 1500)
      }
    },
    onUploadError: (error) => {
      setError(error)
      setShowUploadFlow(false)
    }
  }) as {
    uploads: Selfie[],
    selectedIds: string[],
    loading: boolean,
    loadSelected: () => Promise<void>,
    handlePhotoUpload: (file: File) => Promise<{ key: string; url?: string }>,
    handleSelfiesApproved: (results: { key: string; selfieId?: string }[]) => void
  }


  // Handle selection changes from SelfieGallery
  const handleSelectionChange = useCallback(() => {
    // Reload selection state when gallery changes selections
    loadSelected()
  }, [loadSelected])

  // Filter selectedIds to only include selfies that actually exist in the current list
  // This prevents stale selections from showing incorrect counts
  const validSelectedIds = selectedIds.filter(id => hookSelfies.some(s => s.id === id))
  const selectedCount = validSelectedIds.length
  const canContinue = selectedCount >= 2

  // Only show continue button when coming from generation flow (not when just managing selfies)
  const [isInGenerationFlow, setIsInGenerationFlow] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const fromGeneration = sessionStorage.getItem('fromGeneration') === 'true'
      const openStartFlow = sessionStorage.getItem('openStartFlow') === 'true'
      // Only show continue button if explicitly in generation flow, not just when managing selfies
      setIsInGenerationFlow(fromGeneration || openStartFlow)
      
      // Detect mobile viewport
      const checkMobile = () => {
        setIsMobile(window.innerWidth < 768) // md breakpoint
      }
      checkMobile()
      window.addEventListener('resize', checkMobile)
      return () => window.removeEventListener('resize', checkMobile)
    }
  }, [])
  
  // Auto-open upload on mobile when in generation flow
  useEffect(() => {
    if (isMobile && isInGenerationFlow && !showUploadFlow && !isApproved) {
      setShowUploadFlow(true)
    }
  }, [isMobile, isInGenerationFlow, showUploadFlow, isApproved])

  const handleContinue = () => {
    if (canContinue) {
      // Navigate back to dashboard and open start flow
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('openStartFlow', 'true')
      }
      router.push(`/invite-dashboard/${token}`)
    }
  }


  const handleCancelUpload = () => {
    setShowUploadFlow(false)
    setIsApproved(false)
  }

  const handleRetake = () => {
    // Keep upload flow open for retake
    setIsApproved(false)
  }

  if (loading) { // loading comes from useSelfieManagement hook
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading selfies...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <InviteDashboardHeader
        // Self-contained header renders the consolidated invite copy
        showBackToDashboard
        token={token}
        title=""
        onBackClick={() => {
          // Clear sessionStorage flags to prevent auto-continuing to generation
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('openStartFlow')
            sessionStorage.removeItem('fromGeneration')
            sessionStorage.removeItem('pendingGeneration')
          }
          router.replace(`/invite-dashboard/${token}`)
        }}
      />

      

      {/* Success Message - Show above selfies on mobile */}
      {isApproved && (
        <div className="md:hidden bg-white border-b border-gray-200 px-4 py-4">
          <SelfieUploadSuccess className="border-0 shadow-none p-0" />
        </div>
      )}

      {/* Mobile: Selfies section breaks out of padding container */}
      {!uploadOnly && (
        <>
          {/* Mobile: Direct content, no wrapper, with padding */}
          <div className="md:hidden bg-white">
            <div className="px-4 pt-4 flex items-center justify-between gap-3">
              <SelfieSelectionInfoBanner selectedCount={selectedCount} className="flex-1 mb-0" />
              {isInGenerationFlow && (
                <button
                  onClick={handleContinue}
                  disabled={!canContinue}
                  className={`px-5 py-3 text-base font-semibold rounded-lg flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary shadow-md ${
                    canContinue
                      ? 'text-white bg-brand-primary hover:bg-brand-primary-hover'
                      : 'text-gray-400 bg-gray-200 cursor-not-allowed'
                  }`}
                >
                  Continue
                </button>
              )}
            </div>
            <div className="px-4 pt-2 pb-4">
                  <SelfieGallery
                    selfies={hookSelfies.map(s => ({
                      id: s.id,
                      key: s.key,
                      url: s.url,
                      uploadedAt: s.uploadedAt,
                      used: s.used
                    }))}
                token={token}
                allowDelete
                showUploadTile={!showUploadFlow && !(isMobile && isInGenerationFlow)}
                onUploadClick={() => setShowUploadFlow(true)}
                onAfterChange={handleSelectionChange}
                onDeleted={async () => {
                  // The hook's loadUploads will reload both selfies and selected state
                  // loadSelected() // Not needed - hook handles this
                }}
              />
            </div>
          </div>
        </>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && <ErrorBanner message={error} className="mb-6" />}

        <div className="space-y-6">
          {/* Upload Flow - use SelfieUploadFlow component */}
          {/* On mobile in generation flow, keep showing even after approval */}
          {/* Hide when approved (approval is handled inside SelfieUploadFlow) */}
          {showUploadFlow && !isApproved && (
            <SelfieUploadFlow
              hideHeader={true}
              uploadEndpoint={handlePhotoUpload}
              saveEndpoint={saveSelfieEndpoint}
              onSelfiesApproved={handleSelfiesApproved!}
              onCancel={handleCancelUpload}
              onRetake={handleRetake}
            />
          )}

          {/* Success Message - Desktop only (mobile version is above selfies section) */}
          {isApproved && !showUploadFlow && (
            <div className="hidden md:block">
              <SelfieUploadSuccess />
            </div>
          )}

          {/* Selfies Grid (hidden in upload-only mode) - Desktop only */}
          {!uploadOnly && (
              <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200">
                {/* Desktop: Title and continue button (only in generation flow) */}
                <div className="flex p-6 items-center justify-between">
                  <h2 className="text-lg md:text-2xl font-semibold text-gray-900">Your Selfies</h2>
                  {isInGenerationFlow && (
                    <button
                      onClick={handleContinue}
                      disabled={!canContinue}
                      className={`px-5 py-3 text-base font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary shadow-md ${
                        canContinue
                          ? 'text-white bg-brand-primary hover:bg-brand-primary-hover'
                          : 'text-gray-400 bg-gray-200 cursor-not-allowed'
                      }`}
                    >
                      Continue
                    </button>
                  )}
                </div>
                {/* Desktop: Info banner */}
                <div className="px-6 pb-4">
                  <SelfieSelectionInfoBanner selectedCount={selectedCount} />
                </div>
                <div className="px-6 pt-2 pb-6">
                  <SelfieGallery
                    selfies={hookSelfies.map(s => ({
                      id: s.id,
                      key: s.key,
                      url: s.url,
                      uploadedAt: s.uploadedAt,
                      used: s.used
                    }))}
                    token={token}
                    allowDelete
                    showUploadTile={!showUploadFlow && !(isMobile && isInGenerationFlow)}
                    onUploadClick={() => setShowUploadFlow(true)}
                    onAfterChange={handleSelectionChange}
                    onDeleted={async () => {
                      // The hook will reload both selfies and selected state
                      await loadSelected()
                    }}
                  />
                </div>
              </div>
          )}
        </div>
      </div>
    </div>
  )
}
