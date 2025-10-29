'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/routing'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import PhotoStyleSettings from '@/components/customization/PhotoStyleSettings'
import { PhotoStyleSettings as PhotoStyleSettingsType, DEFAULT_PHOTO_STYLE_SETTINGS } from '@/types/photo-style'
import { jsonFetcher } from '@/lib/fetcher'

export default function CreateTeamContextPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  const [name, setName] = useState('')
  const [photoStyleSettings, setPhotoStyleSettings] = useState<PhotoStyleSettingsType>(DEFAULT_PHOTO_STYLE_SETTINGS)
  const [customPrompt, setCustomPrompt] = useState('')
  const [setAsActive, setSetAsActive] = useState(false)

  const handleSave = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      await jsonFetcher('/api/contexts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          settings: photoStyleSettings,
          customPrompt,
          setAsActive,
          contextType: 'team'
        })
      })

      setSuccess('Team style created successfully!')
      setTimeout(() => {
        router.push('/app/contexts/team')
      }, 1500)
    } catch {
      setError('Failed to create team style')
    } finally {
      setLoading(false)
    }
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
            Create Team Photo Style
          </h1>
          <p className="text-gray-600 mt-1">
            Create a new team photo style for consistent team photo generation
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
              disabled={loading || !name.trim()}
              className="px-6 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Style'}
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
