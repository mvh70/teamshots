'use client'

import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import SelfieGallery from '@/components/generation/SelfieGallery'
import { jsonFetcher } from '@/lib/fetcher'
import { LoadingGrid } from '@/components/ui'
import { useSelfieSelection } from '@/hooks/useSelfieSelection'
import SelfieSelectionInfoBanner from '@/components/generation/SelfieSelectionInfoBanner'

const SelfieUploadFlow = dynamic(() => import('@/components/Upload/SelfieUploadFlow'), { ssr: false })

interface UploadListItem {
  id: string
  uploadedKey: string
  validated: boolean
  createdAt: string
  hasGenerations: boolean
}

export default function SelfieSelectionPage() {
  const t = useTranslations('generate.selfie')
  const router = useRouter()
  const { data: session } = useSession()
  const [uploads, setUploads] = useState<UploadListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const { selectedIds, loadSelected, toggleSelect } = useSelfieSelection({})

  // Load uploads from API
  const loadUploads = async () => {
    setLoading(true)
    try {
      const data = await jsonFetcher<{ items?: UploadListItem[] }>('/api/uploads/list', { credentials: 'include' })
      // No longer need to fetch selected state here since gallery gets it from props
      const items = data.items || []
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

  // Auto-show upload interface when no selfies exist
  useEffect(() => {
    if (!loading && uploads.length === 0) {
      setShowUpload(true)
    }
  }, [loading, uploads.length])

  const handleSelfiesApproved = async (results: { key: string; selfieId?: string }[]) => {
    console.log('=== handleSelfiesApproved CALLED ===', { count: results.length, results })

    // Hide upload flow first
    setShowUpload(false)

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

    // Reload uploads list
    await loadUploads()
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

      {showUpload && (
        <SelfieUploadFlow
          onSelfiesApproved={handleSelfiesApproved}
          onCancel={() => setShowUpload(false)}
          onError={(error) => {
            console.error('Selfie upload error:', error)
            // Show error to user
            alert(`Error: ${error}`)
            // Hide upload flow on error so user can see the error
            setShowUpload(false)
          }}
        />
      )}

      {!showUpload && (
        <>

          {loading ? (
            <LoadingGrid cols={4} rows={2} />
          ) : uploads.length > 0 ? (
            <SelfieGallery
              selfies={uploads.map(u => ({ id: u.id, key: u.uploadedKey, url: `/api/files/get?key=${encodeURIComponent(u.uploadedKey)}`, uploadedAt: u.createdAt, used: u.hasGenerations }))}
              allowDelete={false}
              showUploadTile
              onUploadClick={() => setShowUpload(true)}
              onAfterChange={handleSelectionChange}
            />
          ) : (
            <div className="text-center py-16 bg-white rounded-lg border">
              <p className="text-gray-700 mb-2">{t('empty.title')}</p>
              <p className="text-gray-500 text-sm mb-4">{t('empty.subtitle')}</p>
              <button 
                onClick={() => setShowUpload(true)}
                className="px-4 py-2 rounded-md bg-brand-primary text-white hover:bg-brand-primary-hover text-sm"
              >
                {t('empty.cta')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
