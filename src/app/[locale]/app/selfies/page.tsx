'use client'

import { useTranslations } from 'next-intl'
import UploadCard from '../generations/components/UploadCard'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import SelfieUploadFlow from '@/components/Upload/SelfieUploadFlow'
import { PrimaryButton, UploadGrid } from '@/components/ui'
import { jsonFetcher } from '@/lib/fetcher'

interface UploadListItem {
  id: string
  uploadedKey: string
  validated: boolean
  createdAt: string
  hasGenerations: boolean
  selected?: boolean
}

export default function SelfiesPage() {
  const t = useTranslations('selfies')
  const { data: session } = useSession()
  const [uploads, setUploads] = useState<UploadListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showUploadFlow, setShowUploadFlow] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load uploads from API
  const loadUploads = async () => {
    setLoading(true)
    try {
      const data = await jsonFetcher<{ items?: UploadListItem[] }>('/api/uploads/list', {
        credentials: 'include' // Required for Safari to send cookies
      })
      let items = data.items || []
      // Fetch selected selfie IDs and merge selection state
      const selectedRes = await jsonFetcher<{ selfies: { id: string }[] }>('/api/selfies/selected', {
        credentials: 'include'
      }).catch(() => ({ selfies: [] as { id: string }[] }))
      const selectedSet = new Set((selectedRes.selfies || []).map(s => s.id))
      items = items.map(it => ({ ...it, selected: selectedSet.has(it.id) }))
      setUploads(items)
    } catch (error) {
      console.error('Failed to load uploads:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user?.id) {
      loadUploads()
    }
  }, [session?.user?.id])

  const deleteUpload = async (uploadId: string) => {
    try {
      // Find the upload to get its key
      const upload = uploads.find(u => u.id === uploadId)
      if (!upload) {
        throw new Error('Upload not found')
      }

      if (!upload.uploadedKey || upload.uploadedKey === 'undefined') {
        throw new Error('Upload key is missing or invalid')
      }
      
      await jsonFetcher(`/api/uploads/delete?key=${encodeURIComponent(upload.uploadedKey)}`, {
        method: 'DELETE',
        credentials: 'include' // Required for Safari to send cookies
      })

      // Remove from local state
      setUploads(prev => prev.filter(upload => upload.id !== uploadId))
    } catch (error) {
      console.error('Failed to delete upload:', error)
      throw error // Re-throw so UploadCard can handle the error
    }
  }

  const handleSelfieApproved = async () => {
    // Reload uploads to show the new selfie
    await loadUploads()
    setShowUploadFlow(false)
    setError(null) // Clear any previous error on successful upload
  }

  const handleCancelUpload = () => {
    setShowUploadFlow(false)
    setError(null)
  }

  const handleUploadError = (errorMessage: string) => {
    setError(errorMessage)
    setShowUploadFlow(false)
  }

  const handleRetake = () => {
    // Keep upload flow open for retake
    setError(null)
  }

  const handleToggleSelect = async (id: string, selected: boolean) => {
    try {
      setUploads(prev => prev.map(u => u.id === id ? { ...u, selected } : u))
      await jsonFetcher(`/api/selfies/${id}/select`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected }),
        credentials: 'include'
      })
    } catch {
      // rollback on failure
      setUploads(prev => prev.map(u => u.id === id ? { ...u, selected: !selected } : u))
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between relative z-10">
        <h1 className="text-2xl font-semibold text-gray-900" data-testid="selfies-title">{t('title')}</h1>
        {!showUploadFlow && (
          <PrimaryButton
            onClick={() => setShowUploadFlow(true)}
            data-testid="upload-cta"
            className="relative z-50 pointer-events-auto"
          >
            {t('empty.cta')}
          </PrimaryButton>
        )}
      </div>

      {!showUploadFlow && (
        <div className="rounded-md border border-brand-secondary/30 bg-green-50 text-gray-800 px-4 py-3 text-sm">
          <p className="mb-1">
            Selfies with a green check are included in your next generation.
          </p>
          <p>
            For the most realistic results, select at least 3 selfies in different lighting and angles. More variety usually improves quality.
          </p>
        </div>
      )}

      {showUploadFlow && (
        <SelfieUploadFlow
          onSelfieApproved={handleSelfieApproved}
          onCancel={handleCancelUpload}
          onError={handleUploadError}
          onRetake={handleRetake}
        />
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4" data-testid="error-message">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Upload Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
              <div className="mt-4">
                <div className="-mx-2 -my-1.5 flex">
                  <button
                    onClick={() => setError(null)}
                    className="bg-red-50 px-2 py-1.5 rounded-md text-sm font-medium text-red-800 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-red-50 focus:ring-red-600"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!showUploadFlow && loading ? (
        <UploadGrid>
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
              <div className="aspect-square bg-gray-200 rounded-lg mb-3"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </UploadGrid>
      ) : !showUploadFlow && uploads.length > 0 ? (
        <UploadGrid data-testid="upload-grid">
          {uploads.map(item => (
            <div key={item.id} data-testid="selfie-card">
              <UploadCard item={item} onDelete={deleteUpload} onToggleSelect={handleToggleSelect} />
            </div>
          ))}
        </UploadGrid>
      ) : !showUploadFlow && (
        <div className="text-center py-16 bg-white rounded-lg border" data-testid="empty-state">
          <p className="text-gray-700 mb-2" data-testid="empty-title">{t('empty.title')}</p>
          <p className="text-gray-500 text-sm mb-4" data-testid="empty-subtitle">{t('empty.subtitle')}</p>
          <PrimaryButton 
            onClick={() => setShowUploadFlow(true)}
            data-testid="upload-cta"
          >
            {t('empty.cta')}
          </PrimaryButton>
        </div>
      )}
    </div>
  )
}
