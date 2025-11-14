'use client'

import { useTranslations } from 'next-intl'
import SelfieGallery from '@/components/generation/SelfieGallery'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import SelfieUploadFlow from '@/components/Upload/SelfieUploadFlow'
import { PrimaryButton, SecondaryButton, LoadingGrid } from '@/components/ui'
import SelfieInfoBanner from '@/components/generation/SelfieInfoBanner'
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between relative z-10">
        <h1 className="text-2xl font-semibold text-gray-900" data-testid="selfies-title">{t('title')}</h1>
      </div>

      {!showUploadFlow && (
        <SelfieInfoBanner variant="detailed" />
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
                  <SecondaryButton
                    onClick={() => setError(null)}
                    size="sm"
                    className="bg-red-50 text-red-800 hover:bg-red-100 focus:ring-red-600"
                  >
                    Dismiss
                  </SecondaryButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!showUploadFlow && loading ? (
        <LoadingGrid cols={4} rows={2} />
      ) : !showUploadFlow && uploads.length > 0 ? (
        <div>
          <SelfieGallery
            selfies={uploads.map(u => ({ id: u.id, key: u.uploadedKey, url: `/api/files/get?key=${encodeURIComponent(u.uploadedKey)}`, uploadedAt: u.createdAt, used: u.hasGenerations }))}
            allowDelete
            showUploadTile
            onUploadClick={() => setShowUploadFlow(true)}
            onDeleted={() => { void loadUploads() }}
          />
        </div>
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
