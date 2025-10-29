'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useRouter } from '@/i18n/routing'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import PhotoStyleSettings from '@/components/customization/PhotoStyleSettings'
import { PhotoStyleSettings as PhotoStyleSettingsType, DEFAULT_PHOTO_STYLE_SETTINGS } from '@/types/photo-style'
import { jsonFetcher } from '@/lib/fetcher'

interface Context {
  id: string
  name: string
  settings?: PhotoStyleSettingsType
  backgroundUrl?: string
  backgroundPrompt?: string
  logoUrl?: string
  stylePreset: string
  customPrompt?: string
  createdAt: string
}

export default function EditTeamContextPage() {
  const params = useParams()
  const router = useRouter()
  const [context, setContext] = useState<Context | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  const [name, setName] = useState('')
  const [photoStyleSettings, setPhotoStyleSettings] = useState<PhotoStyleSettingsType>(DEFAULT_PHOTO_STYLE_SETTINGS)
  const [customPrompt, setCustomPrompt] = useState('')
  const [setAsActive, setSetAsActive] = useState(false)

  useEffect(() => {
    const fetchContext = async () => {
      try {
        const data = await jsonFetcher<{ context?: Context } & Context>(`/api/contexts/${params.id}`)
        const contextData = data.context || data
        
        if (contextData) {
          setContext(contextData)
          setName(contextData.name || '')
          setCustomPrompt(contextData.customPrompt || '')
            
            // Load settings with proper merging
            const existingSettings = contextData.settings || {}
            const mergedSettings: PhotoStyleSettingsType = {
              ...DEFAULT_PHOTO_STYLE_SETTINGS,
              ...existingSettings,
              background: {
                ...DEFAULT_PHOTO_STYLE_SETTINGS.background,
                ...existingSettings.background,
                type: existingSettings.background?.type || DEFAULT_PHOTO_STYLE_SETTINGS.background!.type
              },
              branding: {
                ...DEFAULT_PHOTO_STYLE_SETTINGS.branding,
                ...existingSettings.branding,
                type: existingSettings.branding?.type || DEFAULT_PHOTO_STYLE_SETTINGS.branding!.type
              },
              clothing: {
                ...DEFAULT_PHOTO_STYLE_SETTINGS.clothing,
                ...existingSettings.clothing,
                style: existingSettings.clothing?.style || DEFAULT_PHOTO_STYLE_SETTINGS.clothing!.style
              },
              style: {
                ...DEFAULT_PHOTO_STYLE_SETTINGS.style,
                ...existingSettings.style,
                type: existingSettings.style?.type || DEFAULT_PHOTO_STYLE_SETTINGS.style!.type
              },
              expression: {
                ...DEFAULT_PHOTO_STYLE_SETTINGS.expression,
                ...existingSettings.expression,
                type: existingSettings.expression?.type || DEFAULT_PHOTO_STYLE_SETTINGS.expression!.type
              },
              lighting: {
                ...DEFAULT_PHOTO_STYLE_SETTINGS.lighting,
                ...existingSettings.lighting,
                type: existingSettings.lighting?.type || DEFAULT_PHOTO_STYLE_SETTINGS.lighting!.type
              }
            }
            setPhotoStyleSettings(mergedSettings)
        } else {
          setError('Failed to load context')
        }
      } catch {
        setError('Failed to load context')
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      fetchContext()
    }
  }, [params.id])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      await jsonFetcher(`/api/contexts/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          settings: photoStyleSettings,
          customPrompt,
          setAsActive
        })
      })

      setSuccess('Team style updated successfully!')
      setTimeout(() => {
        router.push('/app/contexts/team')
      }, 1500)
    } catch {
      setError('Failed to update context')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    )
  }

  if (error && !context) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
        <button
          onClick={() => router.push('/app/contexts/team')}
          className="mt-2 px-4 py-2 bg-red-100 text-red-800 rounded-md hover:bg-red-200"
        >
          Back to Team Photo Styles
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/app/contexts/team')}
          className="p-2 text-gray-400 hover:text-gray-600"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Edit Team Photo Style
          </h1>
          <p className="text-gray-600 mt-1">
            Customize your team photo style settings
          </p>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800">{success}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Style Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              placeholder="Corporate Headshots"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-4">
              Photo Style Settings
            </label>
            <PhotoStyleSettings
              value={photoStyleSettings}
              onChange={setPhotoStyleSettings}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Custom Prompt
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              placeholder="Additional instructions for this team style..."
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="setAsActive"
              checked={setAsActive}
              onChange={(e) => setSetAsActive(e.target.checked)}
              className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded"
            />
            <label htmlFor="setAsActive" className="ml-2 text-sm text-gray-700">
              Set as Active Team Style
            </label>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="px-6 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={() => router.push('/app/contexts/team')}
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
