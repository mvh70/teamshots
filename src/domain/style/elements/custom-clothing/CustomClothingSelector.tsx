'use client'

/**
 * Custom Clothing Selector Component
 *
 * Allows users to upload an outfit image and configure outfit transfer settings
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import Image from 'next/image'
import { CloudArrowUpIcon } from '@heroicons/react/24/outline'
import { CustomClothingSettings } from './types'
import { Logger } from '@/lib/logger'
import { Telemetry } from '@/lib/telemetry'

interface CustomClothingSelectorProps {
  value: CustomClothingSettings
  onChange: (value: CustomClothingSettings) => void
  disabled?: boolean
  /**
   * Context mode:
   * - 'admin': StyleForm/admin setting up style (show upload when predefined)
   * - 'user': Generation flow (show upload when user-choice)
   */
  mode?: 'admin' | 'user'
  /** Auth token for fetching images from /api/files/get */
  token?: string
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
  mode = 'user',
  token,
}: CustomClothingSelectorProps) {
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const previewSetRef = useRef<string | null>(null)

  // Sync preview URL from value.outfitS3Key when editing existing outfits
  // This is an intentional prop sync pattern: when the parent provides a saved key,
  // we need to generate the preview URL. The ref tracks processed keys to avoid redundant updates.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const currentKey = value.outfitS3Key || null

    // Only set preview if key changed and we haven't set it yet
    if (currentKey && previewSetRef.current !== currentKey) {
      const tokenParam = token ? `&token=${encodeURIComponent(token)}` : ''
      setPreviewUrl(`/api/files/get?key=${encodeURIComponent(currentKey)}${tokenParam}`)
      previewSetRef.current = currentKey
    } else if (!currentKey && previewSetRef.current) {
      // Clear preview if no key
      setPreviewUrl(null)
      previewSetRef.current = null
    }
  }, [value.outfitS3Key, token])
  /* eslint-enable react-hooks/exhaustive-deps */

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

        // Set preview URL immediately
        setPreviewUrl(uploadData.url)
        setUploading(false)

        // Save upload data immediately (before analysis)
        // In admin mode: type='predefined' (admin is setting the preset outfit)
        // In user mode: type='user-choice' (user is customizing their outfit)
        onChange({
          type: mode === 'admin' ? 'predefined' : 'user-choice',
          assetId: uploadData.assetId,
          outfitS3Key: uploadData.s3Key,
          uploadedAt: new Date().toISOString(),
        })

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
          // Analysis failed, but upload succeeded - show warning but keep image
          const errorData = await analysisResponse.json()
          Logger.warn('Color analysis failed, but upload succeeded', {
            assetId: uploadData.assetId,
            error: errorData.error
          })
          setError('Color analysis failed. You can still use this outfit.')
          Telemetry.increment('outfit.analysis.failed')
        } else {
          const analysisData: AnalysisResponse = await analysisResponse.json()
          Logger.info('Outfit colors analyzed', { colors: analysisData.colors })

          // 3. Update settings with colors and description
          onChange({
            type: mode === 'admin' ? 'predefined' : 'user-choice',
            assetId: uploadData.assetId,
            outfitS3Key: uploadData.s3Key,
            colors: analysisData.colors,
            description: analysisData.description,
            uploadedAt: new Date().toISOString(),
          })

          Telemetry.increment('outfit.complete.success')
        }
      } catch (err) {
        // Upload failed - this is a fatal error
        Logger.error('Outfit upload failed', {
          error: err instanceof Error ? err.message : String(err),
        })
        setError(err instanceof Error ? err.message : 'Upload failed')
        setPreviewUrl(null)
        Telemetry.increment('outfit.upload.error')
      } finally {
        setAnalyzing(false)
      }
    },
    [onChange]
  )

  const handleRemove = useCallback(() => {
    onChange({
      type: 'predefined',
    })
    setPreviewUrl(null)
    setError(null)
  }, [onChange])

  // Determine if upload section should be shown based on mode and type
  const shouldShowUpload = mode === 'admin'
    ? value.type === 'predefined'  // Admin mode: show when predefined (admin configures outfit)
    : value.type === 'user-choice'  // User mode: show when user-choice (user customizes outfit)

  return (
    <div className="space-y-4">
      {/* Upload Section - context-aware visibility */}
      {shouldShowUpload && (
        <div className="space-y-3">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-0 text-center relative overflow-hidden">
            {previewUrl ? (
              <div className="relative w-full h-56">
                <Image
                  src={previewUrl}
                  alt="Outfit preview"
                  width={400}
                  height={224}
                  className="absolute inset-0 w-full h-full object-cover"
                  unoptimized
                />
                {/* Loading/Analyzing Overlay */}
                {(uploading || analyzing) && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="text-center text-white">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2" />
                      <p className="text-sm">
                        {uploading ? 'Uploading outfit...' : 'Analyzing colors...'}
                      </p>
                    </div>
                  </div>
                )}
                {/* Choose File Button Overlay */}
                <div className="absolute inset-x-0 bottom-0 p-3 flex justify-center bg-gradient-to-t from-black/30 to-transparent">
                  <label
                    htmlFor="outfit-upload"
                    className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md ${
                      disabled
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-brand-primary text-white hover:bg-brand-primary-hover cursor-pointer'
                    }`}
                  >
                    Choose File
                  </label>
                </div>
              </div>
            ) : (
              <div className="p-6">
                {uploading || analyzing ? (
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-400 mx-auto mb-4" />
                    <p className="text-sm text-gray-600 mb-2">
                      {uploading ? 'Uploading outfit...' : 'Analyzing colors...'}
                    </p>
                  </div>
                ) : (
                  <>
                    <CloudArrowUpIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-sm text-gray-600 mb-2">
                      Click to upload or drag and drop
                    </p>
                    <label
                      htmlFor="outfit-upload"
                      className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md ${
                        disabled
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-brand-primary text-white hover:bg-brand-primary-hover cursor-pointer'
                      }`}
                    >
                      Choose File
                    </label>
                  </>
                )}
              </div>
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/heic"
              onChange={handleFileSelect}
              disabled={disabled || uploading || analyzing}
              className="hidden"
              id="outfit-upload"
            />
          </div>

          {/* Outfit Details - shown after analysis */}
          {value.description && (
            <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
              <p className="font-medium mb-1">Detected outfit:</p>
              <p>{value.description}</p>
            </div>
          )}

          {/* Color Swatches - shown after analysis */}
          {value.colors && (
            <div className="flex gap-2 flex-wrap">
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
