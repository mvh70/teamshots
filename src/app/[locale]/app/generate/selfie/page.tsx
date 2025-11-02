'use client'

import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Link } from '@/i18n/routing'
import dynamic from 'next/dynamic'
import UploadCard from '../../generations/components/UploadCard'
import { jsonFetcher } from '@/lib/fetcher'

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
  const { data: session } = useSession()
  const [uploads, setUploads] = useState<UploadListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)

  // Load uploads from API
  const loadUploads = async () => {
    setLoading(true)
    try {
      const data = await jsonFetcher<{ items?: UploadListItem[] }>('/api/uploads/list')
      setUploads(data.items || [])
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

  const handleSelfieSelect = (selfieKey: string) => {
    // Get generation type from URL parameters
    const urlParams = new URLSearchParams(window.location.search)
    const generationType = urlParams.get('type') || 'personal'
    
    // Navigate to the generation start page with the selected selfie and generation type
    window.location.href = `/app/generate/start?key=${encodeURIComponent(selfieKey)}&type=${generationType}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-600 mt-1">{t('subtitle')}</p>
        </div>
        <Link 
          href="/app/dashboard"
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
        >
          Cancel
        </Link>
      </div>

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
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">{t('select.title')}</h2>
            <button 
              onClick={() => setShowUpload(true)}
              className="px-4 py-2 rounded-md bg-brand-primary text-white hover:bg-brand-primary-hover text-sm"
            >
              {t('select.newSelfie')}
            </button>
          </div>

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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {uploads.map(item => (
                <div key={item.id} className="relative group">
                  <UploadCard item={item} />
                  <button
                    onClick={() => handleSelfieSelect(item.uploadedKey)}
                    className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100"
                  >
                    <span className="bg-white text-gray-900 px-4 py-2 rounded-md text-sm font-medium shadow-lg">
                      {t('select.useThis')}
                    </span>
                  </button>
                </div>
              ))}
            </div>
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
