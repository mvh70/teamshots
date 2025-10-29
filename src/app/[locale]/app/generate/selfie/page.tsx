'use client'

import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Link } from '@/i18n/routing'
import dynamic from 'next/dynamic'
import UploadCard from '../../generations/components/UploadCard'
import SelfieApproval from '@/components/Upload/SelfieApproval'
import { jsonFetcher } from '@/lib/fetcher'

const PhotoUpload = dynamic(() => import('@/components/Upload/PhotoUpload'), { ssr: false })

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
  const [uploadedKey, setUploadedKey] = useState<string | null>(null)
  const [isApproved, setIsApproved] = useState(false)

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

  const handlePhotoUploaded = async (result: { key: string; url?: string }) => {
    try {
      // Set the uploaded key to show approval screen
      setUploadedKey(result.key)
      setShowUpload(false)
    } catch (error) {
      console.error('Failed to handle upload:', error)
      alert('Selfie upload failed. Please try again.')
    }
  }

  const handleApprove = async () => {
    setIsApproved(true)
    // Reload uploads to show the new selfie
    await loadUploads()
    setUploadedKey(null)
  }

  const handleReject = async () => {
    if (uploadedKey) {
      // Delete the uploaded selfie
      try {
        await jsonFetcher(`/api/uploads/delete?key=${encodeURIComponent(uploadedKey)}`, {
          method: 'DELETE',
        })
      } catch (error) {
        console.error('Error deleting rejected selfie:', error)
      }
    }
    setUploadedKey(null)
    setShowUpload(true)
  }

  const handleRetake = async () => {
    if (uploadedKey) {
      // Delete the uploaded selfie
      try {
        await jsonFetcher(`/api/uploads/delete?key=${encodeURIComponent(uploadedKey)}`, {
          method: 'DELETE',
        })
      } catch (error) {
        console.error('Error deleting selfie for retake:', error)
      }
    }
    setUploadedKey(null)
    setShowUpload(true)
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
          href="/dashboard"
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
        >
          Cancel
        </Link>
      </div>

      {uploadedKey && !isApproved && (
        <SelfieApproval
          uploadedPhotoKey={uploadedKey}
          onApprove={handleApprove}
          onReject={handleReject}
          onRetake={handleRetake}
          onCancel={() => {
            setUploadedKey(null)
            setShowUpload(true)
          }}
        />
      )}

      {showUpload && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {uploads.length === 0 ? t('upload.title') : t('upload.title')}
            </h2>
            {uploads.length > 0 && (
              <button
                onClick={() => setShowUpload(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
              >
                Cancel
              </button>
            )}
          </div>
          <p className="text-sm text-gray-600 mb-4">{t('upload.description')}</p>
          <div className="max-w-md">
            <PhotoUpload onUploaded={handlePhotoUploaded} />
          </div>
        </div>
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
