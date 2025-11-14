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
  selected?: boolean
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
      const [data, selectedRes] = await Promise.all([
        jsonFetcher<{ items?: UploadListItem[] }>('/api/uploads/list', { credentials: 'include' }),
        jsonFetcher<{ selfies: { id: string }[] }>('\/api\/selfies\/selected', { credentials: 'include' }).catch(() => ({ selfies: [] as { id: string }[] }))
      ])
      const selectedSet = new Set((selectedRes.selfies || []).map(s => s.id))
      const items = (data.items || []).map(it => ({ ...it, selected: selectedSet.has(it.id) }))
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

  const handleSelfieApproved = async (selfieKey: string, selfieId?: string) => {
    console.log('handleSelfieApproved called', { selfieKey, selfieId })
    
    // Hide upload flow first
    setShowUpload(false)
    
    // Automatically select the newly uploaded selfie
    // Try to find the selfie ID if not provided
    let resolvedSelfieId = selfieId
    
    if (!resolvedSelfieId) {
      console.log('No selfieId provided, trying to find it by key:', selfieKey)
      // Wait a moment for the selfie to be fully saved, then try to find it
      // Retry up to 3 times with increasing delays
      for (let attempt = 0; attempt < 3; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)))
        
        try {
          const findRes = await jsonFetcher<{ id: string }>(`/api/uploads/find-by-key?key=${encodeURIComponent(selfieKey)}`, {
            credentials: 'include'
          })
          if (findRes.id) {
            resolvedSelfieId = findRes.id
            console.log('Found selfie ID:', resolvedSelfieId)
            break
          }
        } catch (error) {
          console.log(`Attempt ${attempt + 1} failed to find selfie:`, error)
          if (attempt === 2) {
            console.error('Error finding selfie by key after retries:', error)
            // Final fallback: try to find it in the uploads list
            try {
              const updatedUploads = await jsonFetcher<{ items?: UploadListItem[] }>('/api/uploads/list', { credentials: 'include' })
              const foundSelfie = (updatedUploads.items || []).find(u => u.uploadedKey === selfieKey)
              if (foundSelfie) {
                resolvedSelfieId = foundSelfie.id
                console.log('Found selfie in uploads list:', resolvedSelfieId)
              }
            } catch (fallbackError) {
              console.error('Error finding selfie in uploads list:', fallbackError)
            }
          }
        }
      }
    } else {
      console.log('Using provided selfieId:', resolvedSelfieId)
    }
    
    // Select the selfie if we have an ID
    if (resolvedSelfieId) {
      try {
        console.log('Selecting selfie:', resolvedSelfieId)
        await toggleSelect(resolvedSelfieId, true)
        // Wait a moment for the selection to persist
        await new Promise(resolve => setTimeout(resolve, 200))
        // Reload selected list to ensure it's up to date
        await loadSelected()
        console.log('Selfie selected successfully')
      } catch (error) {
        console.error('Error selecting newly uploaded selfie:', error)
      }
    } else {
      console.warn('Could not find selfie ID for key:', selfieKey, 'selfieId provided:', selfieId)
    }
    
    // Always reload uploads to show the new selfie and selection state
    console.log('Reloading uploads list...')
    await loadUploads()
    console.log('Uploads list reloaded')
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
          onSelfieApproved={handleSelfieApproved}
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
