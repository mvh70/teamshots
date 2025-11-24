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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-600 mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleContinue}
            disabled={!canContinue}
            className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary ${
              canContinue
                ? 'text-white bg-brand-primary hover:bg-brand-primary-hover'
                : 'text-gray-400 bg-gray-200 cursor-not-allowed'
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
        <div className={isMobile ? 'pb-40' : ''}>
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
