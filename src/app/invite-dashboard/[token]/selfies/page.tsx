'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { formatDate } from '@/lib/format'
import Image from 'next/image'
import { CameraIcon, TrashIcon } from '@heroicons/react/24/outline'
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
  const [uploading, setUploading] = useState(false)
  const [forceCamera, setForceCamera] = useState(false)
  
  // Validation flow state
  const [uploadKey, setUploadKey] = useState<string>('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isApproved, setIsApproved] = useState<boolean>(false)
  // Header resolves invite info internally; no local invite state needed

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
    setUploading(true)
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
    } finally {
      setUploading(false)
    }
  }

  const handleReject = async () => {
    await deleteSelfie()
  }

  const handleRetake = async () => {
    await deleteSelfie()
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

  const handleDelete = async (selfieId: string) => {
    try {
      const response = await fetch(`/api/team/member/selfies/${selfieId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        credentials: 'include' // Required for Safari to send cookies
      })

      if (response.ok) {
        await fetchSelfies() // Refresh the list
      } else {
        console.error('Failed to delete selfie')
      }
    } catch (error) {
      console.error('Error deleting selfie:', error)
    }
  }

  const formatSelfieDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) {
        return 'Unknown date'
      }
      return formatDate(dateString, 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return 'Unknown date'
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
          {/* Upload Section */}
          {!uploadKey && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload New Selfie</h2>
              <div className="max-w-md">
                <PhotoUpload 
                  onUpload={onUploadWithToken}
                  onUploaded={handleUpload}
                  autoOpenCamera={forceCamera}
                  disabled={uploading}
                />
                {uploading && (
                  <p className="mt-2 text-sm text-gray-600">Uploading...</p>
                )}
              </div>
            </div>
          )}

          {/* Validation Flow */}
          {uploadKey && !isApproved && (
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
                }}
              />
            </div>
          )}

          {/* Success Message */}
          {isApproved && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                  <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Your Selfies</h2>
            </div>
            <div className="p-6">
              {selfies.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {selfies.map((selfie) => (
                    <div key={selfie.id} className="relative group">
                      <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                        <Image
                          src={selfie.url}
                          alt="Selfie"
                          width={400}
                          height={400}
                          className="w-full h-full object-cover"
                          unoptimized
                          onError={(e) => {
                            console.error('Image failed to load:', selfie.url, e)
                          }}
                          onLoad={() => {
                            // Image loaded successfully
                          }}
                        />
                      </div>
                      <div className="mt-2">
                        <p className="text-sm text-gray-600">
                          {formatSelfieDate(selfie.uploadedAt)}
                        </p>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          selfie.status === 'approved' 
                            ? 'bg-green-100 text-green-800'
                            : selfie.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {selfie.status}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDelete(selfie.id)}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <CameraIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No selfies yet</h3>
                  <p className="mt-1 text-sm text-gray-500">Upload your first selfie to get started.</p>
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  )
}
