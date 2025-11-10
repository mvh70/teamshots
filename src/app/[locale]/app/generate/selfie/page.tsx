'use client'

import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Link } from '@/i18n/routing'
import dynamic from 'next/dynamic'
import SelfieGallery from '@/components/generation/SelfieGallery'
import SelfieSelectionBanner from '@/components/generation/SelfieSelectionBanner'
import { jsonFetcher } from '@/lib/fetcher'

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
  const { data: session } = useSession()
  const [uploads, setUploads] = useState<UploadListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)

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

  const handleSelfieApproved = async (selfieKey: string) => {
    // After approval, go straight to style selection/start screen with the new selfie
    const urlParams = new URLSearchParams(window.location.search)
    const generationType = urlParams.get('type') || 'personal'
    window.location.href = `/app/generate/start?key=${encodeURIComponent(selfieKey)}&type=${generationType}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-600 mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
        <Link 
            href="/app/generate/start?skipUpload=1"
            className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-brand-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
        >
            Continue
        </Link>
        </div>
      </div>
      <SelfieSelectionBanner />

      {showUpload && (
        <SelfieUploadFlow
          onSelfieApproved={handleSelfieApproved}
          onCancel={() => setShowUpload(false)}
          onError={(error) => {
            console.error('Selfie upload error:', error)
            alert(error)
          }}
        />
      )}

      {!showUpload && (
        <>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
                  <div className="aspect-square bg-gray-200 rounded-lg mb-3"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : uploads.length > 0 ? (
            <SelfieGallery
              selfies={uploads.map(u => ({ id: u.id, key: u.uploadedKey, url: `/api/files/get?key=${encodeURIComponent(u.uploadedKey)}`, uploadedAt: u.createdAt, used: u.hasGenerations }))}
              allowDelete={false}
              showUploadTile
              onUploadClick={() => setShowUpload(true)}
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
