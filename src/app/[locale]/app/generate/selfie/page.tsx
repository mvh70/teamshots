'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import SelfieGallery from '@/components/generation/SelfieGallery'
import { LoadingGrid } from '@/components/ui'
import { useSelfieSelection } from '@/hooks/useSelfieSelection'
import { useSelfieUploads } from '@/hooks/useSelfieUploads'
import SelfieSelectionInfoBanner from '@/components/generation/SelfieSelectionInfoBanner'

function SelfieSelectionPageContent() {
  const t = useTranslations('generate.selfie')
  const router = useRouter()
  const { uploads, loading, loadUploads } = useSelfieUploads()
  const { selectedIds, loadSelected, toggleSelect } = useSelfieSelection({})

  useEffect(() => {
    loadUploads()
  }, [loadUploads])

  const handleSelfiesApproved = async (results: { key: string; selfieId?: string }[]) => {
    console.log('=== handleSelfiesApproved CALLED ===', { count: results.length, results })

    // Auto-select the newly uploaded selfies for consistency with invited user flows
    const validSelfieIds = results
      .map(r => r.selfieId)
      .filter((id): id is string => id !== undefined && id !== null)

    if (validSelfieIds.length > 0) {
      // Auto-select each new selfie
      for (const selfieId of validSelfieIds) {
        try {
          await toggleSelect(selfieId, true)
          await new Promise(resolve => setTimeout(resolve, 200))
          await loadSelected()
        } catch (error) {
          console.error('Error selecting newly uploaded selfie:', error)
        }
      }
      console.log(`Auto-selected ${validSelfieIds.length} newly uploaded selfie(s)`)
    }

    // Reload uploads
    await loadUploads()
  }

  const handleUploadError = (error: string) => {
    console.error('Selfie upload error:', error)
    alert(`Error: ${error}`)
  }

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
        <SelfieGallery
          selfies={uploads.map(u => ({ id: u.id, key: u.uploadedKey, url: `/api/files/get?key=${encodeURIComponent(u.uploadedKey)}`, uploadedAt: u.createdAt, used: u.hasGenerations }))}
          allowDelete={false}
          showUploadTile
          onSelfiesApproved={handleSelfiesApproved}
          onUploadError={handleUploadError}
          onAfterChange={handleSelectionChange}
        />
      )}
    </div>
  )
}

export default function SelfieSelectionPage() {
  return <SelfieSelectionPageContent />
}
