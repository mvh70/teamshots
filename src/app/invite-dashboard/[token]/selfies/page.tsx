'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import SelfieGallery from '@/components/generation/SelfieGallery'
import dynamic from 'next/dynamic'
import InviteDashboardHeader from '@/components/invite/InviteDashboardHeader'
import { ErrorBanner } from '@/components/ui'
import { useSelfieSelection } from '@/hooks/useSelfieSelection'
import SelfieSelectionInfoBanner from '@/components/generation/SelfieSelectionInfoBanner'

const PhotoUpload = dynamic(() => import('@/components/Upload/PhotoUpload'), { ssr: false })
const SelfieApproval = dynamic(() => import('@/components/Upload/SelfieApproval'), { ssr: false })

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

  const [selfies, setSelfies] = useState<Selfie[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [forceCamera, setForceCamera] = useState(false)
  
  // Validation flow state
  const [uploadKey, setUploadKey] = useState<string>('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isApproved, setIsApproved] = useState<boolean>(false)
  // Header resolves invite info internally; no local invite state needed

  // Multi-select: load and manage selected selfies
  const { selectedIds, loadSelected, toggleSelect } = useSelfieSelection({ token })

  const fetchSelfies = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/team/member/selfies?token=${token}`, {
        credentials: 'include' // Required for Safari to send cookies
      })
      
      if (response.ok) {
        const data = await response.json()
        setSelfies(data.selfies)
      } else {
        setError('Failed to fetch selfies')
      }
    } catch {
      setError('Failed to fetch selfies')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchSelfies()
  }, [fetchSelfies])

  // Reload selected selfies when selfies list changes
  useEffect(() => {
    if (!loading && selfies.length > 0) {
      loadSelected()
    }
  }, [loading, selfies.length, loadSelected])

  // Handle selection changes from SelfieGallery
  const handleSelectionChange = useCallback(() => {
    // Reload selection state when gallery changes selections
    loadSelected()
  }, [loadSelected])

  // Filter selectedIds to only include selfies that actually exist in the current list
  // This prevents stale selections from showing incorrect counts
  const validSelectedIds = selectedIds.filter(id => selfies.some(s => s.id === id))
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
    if (isMobile && isInGenerationFlow && !uploadKey && !isApproved) {
      setUploadKey('inline')
    }
  }, [isMobile, isInGenerationFlow, uploadKey, isApproved])

  const handleContinue = () => {
    if (canContinue) {
      // Navigate back to dashboard and open start flow
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('openStartFlow', 'true')
      }
      router.push(`/invite-dashboard/${token}`)
    }
  }

  // No header-data fetching here; header handles it

  const handleUpload = async ({ key, url }: { key: string; url?: string }) => {
    setUploadKey(key)
    if (url) {
      setPreviewUrl(url)
    }
  }

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

  const handleApprove = async () => {
    try {
      const response = await fetch('/api/team/member/selfies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token,
          selfieKey: uploadKey
        }),
        credentials: 'include' // Required for Safari to send cookies
      })

      if (response.ok) {
        const data = await response.json() as { selfie?: { id: string } }
        const selfieId = data.selfie?.id

        // Automatically select the newly uploaded selfie
        if (selfieId) {
          try {
            await toggleSelect(selfieId, true)
            // Wait a moment for the selection to persist
            await new Promise(resolve => setTimeout(resolve, 200))
            // Reload selected list to ensure it's up to date
            await loadSelected()
          } catch (error) {
            console.error('Error selecting newly uploaded selfie:', error)
            // Don't throw - continue with the flow even if selection fails
          }
        }

        // Always stay on selfie selection page - user clicks Continue button to proceed
        // Only navigate away if in upload-only mode
        if (uploadOnly) {
            router.push(`/invite-dashboard/${token}`)
          return
        }
        // Show success briefly but keep upload window open for mobile in generation flow
        setIsApproved(true)
        await fetchSelfies()
        // Clear the uploaded key immediately to prevent approval screen from showing again
        // On mobile in generation flow, reset to 'inline' to keep upload window open
        // Otherwise, clear completely
        if (isMobile && isInGenerationFlow) {
          // Reset to 'inline' immediately to keep upload window open but clear approval state
          // Also reset forceCamera immediately to prevent camera from reopening
          setUploadKey('inline')
          setPreviewUrl(null)
          setForceCamera(false)
          // Clear approval state after showing success message
          setTimeout(() => {
            setIsApproved(false)
          }, 1500)
        } else {
          // Reset completely after showing success message
          setTimeout(() => {
            setUploadKey('')
            setPreviewUrl(null)
            setIsApproved(false)
            setForceCamera(false)
        }, 1500)
        }
      } else {
        console.error('Failed to save selfie')
        setError('Failed to save selfie')
      }
    } catch (error) {
      console.error('Error saving selfie:', error)
      setError('Failed to save selfie')
    }
  }

  const handleReject = async () => {
    await deleteSelfie()
  }

  const handleRetake = async () => {
    await deleteSelfie()
    setUploadKey('inline')
    setForceCamera(true)
  }

  const deleteSelfie = async () => {
    if (!uploadKey) return
    
    try {
      const response = await fetch(`/api/uploads/delete?key=${encodeURIComponent(uploadKey)}`, {
        method: 'DELETE',
      })
      
      if (response.ok) {
        setUploadKey('')
        setPreviewUrl(null)
        setIsApproved(false)
      } else {
        console.error('Failed to delete selfie')
      }
    } catch (error) {
      console.error('Error deleting selfie:', error)
    }
  }

  if (loading) {
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

      

      {/* Approval Flow - Show above selfies on mobile */}
      {uploadKey && uploadKey !== 'inline' && !isApproved && (
        <div className="md:hidden bg-white border-b border-gray-200">
          <div className="px-4 py-4">
            <SelfieApproval
              uploadedPhotoKey={uploadKey}
              previewUrl={previewUrl || undefined}
              onApprove={handleApprove}
              onReject={handleReject}
              onRetake={handleRetake}
              onCancel={() => {
                // Always return to selfie selection screen by clearing upload state
                setUploadKey('')
                setPreviewUrl(null)
                setForceCamera(false)
              }}
            />
          </div>
        </div>
      )}

      {/* Success Message - Show above selfies on mobile */}
      {isApproved && (
        <div className="md:hidden bg-white border-b border-gray-200 px-4 py-4">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-10 w-10 rounded-full bg-brand-secondary/10 mb-3">
              <svg className="h-5 w-5 text-brand-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Selfie Approved!</h3>
            <p className="text-xs text-gray-600">Your selfie has been saved successfully.</p>
          </div>
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
                selfies={selfies.map(s => ({ 
                  id: s.id, 
                  key: s.key, 
                  url: s.url, 
                  uploadedAt: s.uploadedAt,
                  used: s.used 
                }))}
                token={token}
                allowDelete
                showUploadTile={!uploadKey && !(isMobile && isInGenerationFlow)}
                onUploadClick={() => setUploadKey('inline')}
                onAfterChange={handleSelectionChange}
                onDeleted={async () => { 
                  await fetchSelfies()
                  await loadSelected()
                }}
              />
            </div>
          </div>
        </>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && <ErrorBanner message={error} className="mb-6" />}

        <div className="space-y-6">
          {/* Upload Flow - show PhotoUpload when uploadKey is 'inline' */}
          {/* On mobile in generation flow, keep showing even after approval */}
          {uploadKey === 'inline' && (!isApproved || (isMobile && isInGenerationFlow)) && (
            <div className="md:bg-white md:rounded-lg md:shadow-sm md:border md:border-gray-200 md:p-6 md:static fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-50 md:z-auto">
              <PhotoUpload
                onUpload={onUploadWithToken}
                onUploaded={handleUpload}
                autoOpenCamera={forceCamera}
              />
            </div>
          )}

          {/* Validation Flow - show approval when there's an actual uploaded key (Desktop only - mobile version is above) */}
          {uploadKey && uploadKey !== 'inline' && !isApproved && (
            <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <SelfieApproval
                uploadedPhotoKey={uploadKey}
                previewUrl={previewUrl || undefined}
                onApprove={handleApprove}
                onReject={handleReject}
                onRetake={handleRetake}
                onCancel={() => {
                  // Always return to selfie selection screen by clearing upload state
                  setUploadKey('')
                  setPreviewUrl(null)
                  setForceCamera(false)
                }}
              />
            </div>
          )}

          {/* Success Message - Desktop only (mobile version is above selfies section) */}
          {isApproved && (
            <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-brand-secondary/10 mb-4">
                  <svg className="h-6 w-6 text-brand-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-2">Selfie Approved!</h3>
                <p className="text-sm text-gray-600">Your selfie has been saved successfully.</p>
              </div>
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
                    selfies={selfies.map(s => ({ 
                      id: s.id, 
                      key: s.key, 
                      url: s.url, 
                      uploadedAt: s.uploadedAt,
                      used: s.used 
                    }))}
                    token={token}
                    allowDelete
                    showUploadTile={!uploadKey && !(isMobile && isInGenerationFlow)}
                    onUploadClick={() => setUploadKey('inline')}
                    onAfterChange={handleSelectionChange}
                    onDeleted={async () => { 
                      await fetchSelfies()
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
