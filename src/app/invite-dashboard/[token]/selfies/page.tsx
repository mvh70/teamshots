'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import SelfieGallery from '@/components/generation/SelfieGallery'
import SelfieInfoBanner from '@/components/generation/SelfieInfoBanner'
import dynamic from 'next/dynamic'
import InviteDashboardHeader from '@/components/invite/InviteDashboardHeader'

const PhotoUpload = dynamic(() => import('@/components/Upload/PhotoUpload'), { ssr: false })
const SelfieApproval = dynamic(() => import('@/components/Upload/SelfieApproval'), { ssr: false })

interface Selfie {
  id: string
  key: string
  url: string
  uploadedAt: string
  status: 'pending' | 'approved' | 'rejected'
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

  const loadSelected = useCallback(async () => {
    try {
      const res = await fetch(`/api/selfies/selected?token=${encodeURIComponent(token)}&t=${Date.now()}`, {
        credentials: 'include',
        cache: 'no-store'
      })
      if (res.ok) {
        // Selection state is managed by SelfieGallery component
      }
    } catch {}
  }, [token])

  useEffect(() => { loadSelected() }, [loadSelected])

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
        // If part of the generation/start-flow, immediately return to dashboard to continue
        const fromGeneration = sessionStorage.getItem('fromGeneration')
        if (fromGeneration === 'true' || uploadOnly) {
          sessionStorage.setItem('pendingGeneration', 'true')
          sessionStorage.removeItem('fromGeneration')
            router.push(`/invite-dashboard/${token}`)
          return
        }
        // Otherwise show success briefly and reset
        setIsApproved(true)
        await fetchSelfies()
          setTimeout(() => {
            setUploadKey('')
            setPreviewUrl(null)
            setIsApproved(false)
        }, 1500)
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
      />

      

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Upload Flow - show PhotoUpload when uploadKey is 'inline' */}
          {uploadKey === 'inline' && !isApproved && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <PhotoUpload
                onUpload={onUploadWithToken}
                onUploaded={handleUpload}
                autoOpenCamera={forceCamera}
              />
            </div>
          )}

          {/* Validation Flow - show approval when there's an actual uploaded key */}
          {uploadKey && uploadKey !== 'inline' && !isApproved && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <SelfieApproval
                uploadedPhotoKey={uploadKey}
                previewUrl={previewUrl || undefined}
                onApprove={handleApprove}
                onReject={handleReject}
                onRetake={handleRetake}
                onCancel={() => {
                  // If this page was opened in upload-only mode from the start flow, go back to dashboard and reopen start flow
                  const fromStartFlow = (typeof window !== 'undefined') && (uploadOnly || sessionStorage.getItem('openStartFlow') === 'true')
                  if (fromStartFlow) {
                    if (typeof window !== 'undefined') {
                      sessionStorage.setItem('openStartFlow', 'true')
                    }
                    router.push(`/invite-dashboard/${token}`)
                    return
                  }
                  setUploadKey('')
                  setPreviewUrl(null)
                  setForceCamera(false)
                }}
              />
            </div>
          )}

          {/* Success Message */}
          {isApproved && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-brand-secondary/10 mb-4">
                  <svg className="h-6 w-6 text-brand-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Selfie Approved!</h3>
                <p className="text-sm text-gray-600">Your selfie has been saved successfully.</p>
              </div>
            </div>
          )}

          {/* Selfies Grid (hidden in upload-only mode) */}
          {!uploadOnly && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900">Your Selfies</h2>
            </div>
            <div className="px-6 pt-2 pb-6">
              <SelfieInfoBanner compact className="mb-6" />
              <SelfieGallery
                selfies={selfies}
                token={token}
                allowDelete
                showUploadTile={!uploadKey}
                onUploadClick={() => setUploadKey('inline')}
                onDeleted={async () => { await fetchSelfies() }}
              />
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  )
}
