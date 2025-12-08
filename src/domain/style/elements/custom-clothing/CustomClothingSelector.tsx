'use client'

/**
 * Custom Clothing Selector Component
 *
 * Allows users to upload an outfit image and configure outfit transfer settings
 */

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { CustomClothingSettings } from './types'
import { Logger } from '@/lib/logger'
import { Telemetry } from '@/lib/telemetry'

interface CustomClothingSelectorProps {
  value: CustomClothingSettings
  onChange: (value: CustomClothingSettings) => void
  disabled?: boolean
}

interface UploadResponse {
  s3Key: string
  assetId: string
  url: string
  reused?: boolean
}

interface AnalysisResponse {
  colors: {
    topBase: string
    topCover?: string
    bottom: string
    shoes?: string
  }
  description: string
}

export function CustomClothingSelector({
  value,
  onChange,
  disabled = false,
}: CustomClothingSelectorProps) {
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    value.assetId ? `/api/files/get?assetId=${value.assetId}` : null
  )

  const handleToggle = useCallback(() => {
    onChange({ ...value, enabled: !value.enabled })
  }, [value, onChange])

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      // Validate file type
      const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/heic']
      if (!allowedTypes.includes(file.type)) {
        setError('Invalid file type. Please upload a PNG, JPEG, WebP, or HEIC image.')
        return
      }

      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024
      if (file.size > maxSize) {
        setError('File too large. Maximum size is 10MB.')
        return
      }

      setError(null)
      setUploading(true)
      Telemetry.increment('outfit.upload.started')

      try {
        // 1. Upload the outfit image
        const uploadResponse = await fetch('/api/outfit/upload', {
          method: 'POST',
          headers: {
            'Content-Type': file.type,
          },
          body: file,
        })

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json()
          throw new Error(errorData.error || 'Upload failed')
        }

        const uploadData: UploadResponse = await uploadResponse.json()
        Logger.info('Outfit uploaded', { assetId: uploadData.assetId, reused: uploadData.reused })

        // Set preview URL
        setPreviewUrl(uploadData.url)

        // 2. Analyze colors using Gemini
        setAnalyzing(true)
        Telemetry.increment('outfit.analysis.started')

        // Convert file to base64
        const reader = new FileReader()
        reader.readAsDataURL(file)
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string
            // Extract base64 data (remove data URL prefix)
            const base64 = result.split(',')[1]
            resolve(base64)
          }
          reader.onerror = reject
        })

        const base64Data = await base64Promise

        const analysisResponse = await fetch('/api/outfit/analyze-colors', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageData: base64Data,
            mimeType: file.type,
          }),
        })

        if (!analysisResponse.ok) {
          const errorData = await analysisResponse.json()
          throw new Error(errorData.error || 'Color analysis failed')
        }

        const analysisData: AnalysisResponse = await analysisResponse.json()
        Logger.info('Outfit colors analyzed', { colors: analysisData.colors })

        // 3. Update settings with all data
        onChange({
          enabled: true,
          assetId: uploadData.assetId,
          outfitS3Key: uploadData.s3Key,
          colors: analysisData.colors,
          description: analysisData.description,
          uploadedAt: new Date().toISOString(),
        })

        Telemetry.increment('outfit.complete.success')
      } catch (err) {
        Logger.error('Outfit upload/analysis failed', {
          error: err instanceof Error ? err.message : String(err),
        })
        setError(err instanceof Error ? err.message : 'Upload failed')
        Telemetry.increment('outfit.complete.error')
      } finally {
        setUploading(false)
        setAnalyzing(false)
      }
    },
    [onChange]
  )

  const handleRemove = useCallback(() => {
    onChange({
      enabled: false,
    })
    setPreviewUrl(null)
    setError(null)
  }, [onChange])

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <label htmlFor="custom-clothing-toggle" className="text-sm font-medium">
            Custom Clothing
          </label>
          <p className="text-sm text-gray-500">Upload an outfit to match in your headshots</p>
        </div>
        <button
          id="custom-clothing-toggle"
          type="button"
          role="switch"
          aria-checked={value.enabled}
          onClick={handleToggle}
          disabled={disabled}
          className={`
            relative inline-flex h-6 w-11 items-center rounded-full transition-colors
            ${value.enabled ? 'bg-blue-600' : 'bg-gray-200'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <span
            className={`
              inline-block h-4 w-4 transform rounded-full bg-white transition-transform
              ${value.enabled ? 'translate-x-6' : 'translate-x-1'}
            `}
          />
        </button>
      </div>

      {/* Upload Section */}
      {value.enabled && (
        <div className="space-y-4">
          {/* Preview or Upload Button */}
          {previewUrl ? (
            <div className="space-y-2">
              <div className="relative rounded-lg border border-gray-200 overflow-hidden">
                <Image
                  src={previewUrl}
                  alt="Outfit preview"
                  className="w-full h-48 object-cover"
                  width={800}
                  height={480}
                  sizes="(max-width: 768px) 100vw, 800px"
                  priority={false}
                />
              </div>

              {/* Outfit Details */}
              {value.description && (
                <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
                  <p className="font-medium mb-1">Detected outfit:</p>
                  <p>{value.description}</p>
                </div>
              )}

              {/* Color Swatches */}
              {value.colors && (
                <div className="flex gap-2">
                  <div className="flex items-center gap-1">
                    <div
                      className="w-6 h-6 rounded border border-gray-300"
                      style={{ backgroundColor: value.colors.topBase }}
                      title="Top base color"
                    />
                    <span className="text-xs text-gray-500">Top</span>
                  </div>
                  {value.colors.topCover && (
                    <div className="flex items-center gap-1">
                      <div
                        className="w-6 h-6 rounded border border-gray-300"
                        style={{ backgroundColor: value.colors.topCover }}
                        title="Top cover color"
                      />
                      <span className="text-xs text-gray-500">Jacket</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <div
                      className="w-6 h-6 rounded border border-gray-300"
                      style={{ backgroundColor: value.colors.bottom }}
                      title="Bottom color"
                    />
                    <span className="text-xs text-gray-500">Bottom</span>
                  </div>
                  {value.colors.shoes && (
                    <div className="flex items-center gap-1">
                      <div
                        className="w-6 h-6 rounded border border-gray-300"
                        style={{ backgroundColor: value.colors.shoes }}
                        title="Shoes color"
                      />
                      <span className="text-xs text-gray-500">Shoes</span>
                    </div>
                  )}
                </div>
              )}

              {/* Remove Button */}
              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled}
                className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                Remove outfit
              </button>
            </div>
          ) : (
            <div>
              <label
                htmlFor="outfit-upload"
                className={`
                  flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer
                  ${uploading || analyzing ? 'bg-gray-50 border-gray-300' : 'bg-white border-gray-300 hover:bg-gray-50'}
                  ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {uploading ? (
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Uploading outfit...</p>
                  </div>
                ) : analyzing ? (
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Analyzing colors...</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 48 48"
                      aria-hidden="true"
                    >
                      <path
                        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <p className="text-sm text-gray-600 mt-2">
                      Click to upload outfit image
                    </p>
                    <p className="text-xs text-gray-500 mt-1">PNG, JPEG, WebP up to 10MB</p>
                  </div>
                )}
                <input
                  id="outfit-upload"
                  type="file"
                  className="sr-only"
                  accept="image/png,image/jpeg,image/webp,image/heic"
                  onChange={handleFileSelect}
                  disabled={disabled || uploading || analyzing}
                />
              </label>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
