'use client'

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

function SelfieSelectionPageContent() {
  const t = useTranslations('generate.selfie')
  const router = useRouter()
  const { data: session } = useSession()
  const [forceShowUpload, setForceShowUpload] = useState(false)
  const [uploads, setUploads] = useState<UploadListItem[]>([])
  const [loading, setLoading] = useState(true)
  const { selectedIds, loadSelected, toggleSelect } = useSelfieSelection({})

  const loadUploads = useCallback(async () => {
    if (!session?.user?.id) {
      setUploads([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const data = await jsonFetcher<{ items?: UploadListItem[] }>('/api/uploads/list', {
        credentials: 'include'
      })

      // Fetch selected selfie IDs and merge selection state
      const selectedRes = await jsonFetcher<{ selfies: { id: string }[] }>('/api/selfies/selected', {
        credentials: 'include'
      }).catch(() => ({ selfies: [] as { id: string }[] }))

      const selectedSet = new Set((selectedRes.selfies || []).map(s => s.id))
      const items = (data.items || []).map(it => ({ ...it, selected: selectedSet.has(it.id) }))

      setUploads(items)
      
      // Load selected IDs into the selection hook
      if (selectedRes.selfies && selectedRes.selfies.length > 0) {
        await loadSelected()
      }
    } catch (err) {
      console.error('Error loading uploads:', err)
      setUploads([])
    } finally {
      setLoading(false)
    }
  }, [session?.user?.id, loadSelected])

  useEffect(() => {
    loadUploads()
  }, [session?.user?.id])

  // Compute whether to show upload interface (derived state)
  const shouldShowUpload = (!loading && uploads.length === 0) || forceShowUpload

  const handleSelfiesApproved = async (results: { key: string; selfieId?: string }[]) => {
    console.log('=== handleSelfiesApproved CALLED ===', { count: results.length, results })

    // Hide upload flow first
    setForceShowUpload(false)

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

      {shouldShowUpload && (
        <SelfieUploadFlow
          onSelfiesApproved={handleSelfiesApproved}
          onCancel={() => {
            // Reset forced upload display
            setForceShowUpload(false)
          }}
          onError={(error) => {
            console.error('Selfie upload error:', error)
            // Show error to user
            alert(`Error: ${error}`)
            // Reset forced upload display on error
            setForceShowUpload(false)
          }}
        />
      )}

      {!shouldShowUpload && (
        <>
          {loading ? (
            <LoadingGrid cols={4} rows={2} />
          ) : uploads.length > 0 ? (
            <SelfieGallery
              selfies={uploads.map(u => ({ id: u.id, key: u.uploadedKey, url: `/api/files/get?key=${encodeURIComponent(u.uploadedKey)}`, uploadedAt: u.createdAt, used: u.hasGenerations }))}
              allowDelete={false}
              showUploadTile
              onUploadClick={() => setForceShowUpload(true)}
              onAfterChange={handleSelectionChange}
            />
          ) : (
            <div className="text-center py-16 bg-white rounded-lg border">
              <p className="text-gray-700 mb-2">{t('empty.title')}</p>
              <p className="text-gray-500 text-sm mb-4">{t('empty.subtitle')}</p>
              <button 
                onClick={() => setForceShowUpload(true)}
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

export default function SelfieSelectionPage() {
  return <SelfieSelectionPageContent />
}
