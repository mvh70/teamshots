'use client'

import { useTranslations } from 'next-intl'
import SelfieGallery from '@/components/generation/SelfieGallery'
import { useState, useEffect } from 'react'
import { SecondaryButton, LoadingGrid } from '@/components/ui'
import { useSelfieManagement } from '@/hooks/useSelfieManagement'
import SelfieInfoBanner from '@/components/generation/SelfieInfoBanner'
import dynamic from 'next/dynamic'

const SelfieUploadFlow = dynamic(() => import('@/components/Upload/SelfieUploadFlow'), { ssr: false })

interface UploadListItem {
  id: string
  uploadedKey: string
  validated: boolean
  createdAt: string
  hasGenerations: boolean
}


function SelfiesPageContent() {
  const t = useTranslations('selfies')
  const [error, setError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  
  const { uploads, loading, loadUploads } = useSelfieManagement() as { uploads: UploadListItem[], loading: boolean, loadUploads: () => void }

  // Hook handles initialization internally
  
  // Detect mobile viewport
  // Detect mobile screen size - intentional client-only pattern
  /* eslint-disable react-you-might-not-need-an-effect/no-initialize-state */
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const checkMobile = () => {
        setIsMobile(window.innerWidth < 768) // md breakpoint
      }
      checkMobile()
      window.addEventListener('resize', checkMobile)
      return () => window.removeEventListener('resize', checkMobile)
    }
  }, [])
  /* eslint-enable react-you-might-not-need-an-effect/no-initialize-state */

  const handleSelfiesApproved = async () => {
    // Reload uploads after successful upload
    await loadUploads()
    setError(null)
  }

  const handleUploadError = (errorMessage: string) => {
    setError(errorMessage)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between relative z-10 gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight" data-testid="selfies-title">{t('title')}</h1>
          <p className="text-gray-600 text-base sm:text-lg font-medium leading-relaxed">Upload and manage your selfies for photo generation</p>
        </div>
      </div>

      <SelfieInfoBanner variant="detailed" />

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

      {loading ? (
        <LoadingGrid cols={4} rows={2} />
      ) : (
        <div className={isMobile ? 'pb-40' : ''}>
          <SelfieGallery
            selfies={uploads.map(u => ({ id: u.id, key: u.uploadedKey, url: `/api/files/get?key=${encodeURIComponent(u.uploadedKey)}`, uploadedAt: u.createdAt, used: u.hasGenerations }))}
            allowDelete
            showUploadTile={!isMobile}
            onSelfiesApproved={handleSelfiesApproved}
            onUploadError={handleUploadError}
            onDeleted={loadUploads}
          />
        </div>
      )}
      
      {/* Mobile: Always show sticky upload flow at bottom */}
      {isMobile && (
        <SelfieUploadFlow
          hideHeader={true}
          onSelfiesApproved={handleSelfiesApproved}
          onCancel={() => {}}
          onError={handleUploadError}
        />
      )}
    </div>
  )
}

export default function SelfiesPage() {
  return <SelfiesPageContent />
}
