'use client'

import { useTranslations } from 'next-intl'
import { useCallback, useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SelfieGallery from '@/components/generation/SelfieGallery'
import { LoadingGrid } from '@/components/ui'
import { useSelfieManagement } from '@/hooks/useSelfieManagement'
import dynamic from 'next/dynamic'
import SelfieSelectionInfoBanner from '@/components/generation/SelfieSelectionInfoBanner'

const SelfieUploadFlow = dynamic(() => import('@/components/Upload/SelfieUploadFlow'), { ssr: false })

interface UploadListItem {
  id: string
  uploadedKey: string
  validated: boolean
  createdAt: string
  hasGenerations: boolean
}

function SelfieSelectionPageContent() {
  const t = useTranslations('generate.selfie')
  const router = useRouter()
  const [isMobile, setIsMobile] = useState(false)
  
  const { uploads, selectedIds, loading, loadSelected, handleSelfiesApproved, handleUploadError } = useSelfieManagement({
    autoSelectNewUploads: true,
    onSelfiesApproved: async () => {
      // Reload selected state to trigger re-render with updated selectedIds
      await loadSelected()
      // Small delay to allow React to process state updates
      await new Promise(resolve => setTimeout(resolve, 100))
    },
    onUploadError: (error) => {
      console.error('Selfie upload error:', error)
      alert(`Error: ${error}`)
    }
  }) as { uploads: UploadListItem[], selectedIds: string[], loading: boolean, loadSelected: () => Promise<void>, handleSelfiesApproved?: (results: { key: string; selfieId?: string }[]) => Promise<void>, handleUploadError?: (error: string) => void }
  
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


  // Use a ref to prevent infinite loops
  const isLoadingRef = useRef(false)
  const handleSelectionChange = useCallback(() => {
    // Only reload if not already loading
    if (!isLoadingRef.current) {
      isLoadingRef.current = true
      loadSelected().finally(() => {
        isLoadingRef.current = false
      })
    }
  }, [loadSelected])

  // Check if we have at least 2 selfies selected
  const selectedCount = selectedIds.length
  const canContinue = selectedCount >= 2

  const handleContinue = () => {
    if (canContinue) {
      router.push('/app/generate/start?skipUpload=1')
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{t('title')}</h1>
          <p className="text-base text-gray-600 leading-relaxed">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleContinue}
            disabled={!canContinue}
            className={`px-6 py-3 text-sm font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary ${
              canContinue
                ? 'text-white bg-gradient-to-r from-brand-primary to-indigo-600 hover:from-brand-primary-hover hover:to-indigo-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0'
                : 'text-gray-400 bg-gray-100 cursor-not-allowed shadow-sm'
            }`}
          >
            Continue
          </button>
        </div>
      </div>
      <SelfieSelectionInfoBanner selectedCount={selectedCount} />

      {loading ? (
        <LoadingGrid cols={4} rows={2} />
      ) : (
        <div className={isMobile ? 'pb-40' : 'mt-2'}>
          <SelfieGallery
            selfies={uploads.map(u => ({ id: u.id, key: u.uploadedKey, url: `/api/files/get?key=${encodeURIComponent(u.uploadedKey)}`, uploadedAt: u.createdAt, used: u.hasGenerations }))}
            allowDelete={false}
            showUploadTile={!isMobile}
            onSelfiesApproved={handleSelfiesApproved}
            onUploadError={handleUploadError}
            onAfterChange={handleSelectionChange}
          />
        </div>
      )}
      
      {/* Mobile: Always show sticky upload flow at bottom */}
      {isMobile && handleSelfiesApproved && (
        <SelfieUploadFlow
          hideHeader={true}
          onSelfiesApproved={handleSelfiesApproved}
          onCancel={() => {}}
          onError={handleUploadError || (() => {})}
        />
      )}
    </div>
  )
}

export default function SelfieSelectionPage() {
  return <SelfieSelectionPageContent />
}
