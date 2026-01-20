'use client'

/**
 * Custom Clothing Selector Component
 *
 * Allows users to upload an outfit image and configure outfit transfer settings
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
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
    topLayer: string
    baseLayer?: string
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
  const t = useTranslations('customization.photoStyle.customClothing')
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const previewSetRef = useRef<string | null>(null)
  const analyzingRef = useRef(false)

  // Sync preview URL from value.value.outfitS3Key when editing existing outfits
  // This is an intentional prop sync pattern: when the parent provides a saved key,
  // we need to generate the preview URL. The ref tracks processed keys to avoid redundant updates.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const currentKey = value.value?.outfitS3Key || null

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
  }, [value.value?.outfitS3Key, token])
  /* eslint-enable react-hooks/exhaustive-deps */

  // Sync analyzing ref with state for debugging
  useEffect(() => {
    analyzingRef.current = analyzing
    if (analyzing) {
      console.log('[CustomClothingSelector] Analyzing state is true, spinner should be visible')
      // Force check if spinner element exists in DOM
      setTimeout(() => {
        const spinner = document.getElementById('analyzing-spinner-element')
        console.log('[CustomClothingSelector] Spinner element in DOM:', spinner)
        if (spinner) {
          console.log('[CustomClothingSelector] Spinner computed styles:', window.getComputedStyle(spinner))
          console.log('[CustomClothingSelector] Spinner parent:', spinner.parentElement)
        }
      }, 100)
    }
  }, [analyzing])

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

      // Clear error
      setError(null)
      setUploading(true) // Track internally but don't show spinner
    
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

        // Set preview URL first
        setPreviewUrl(uploadData.url)
        setUploading(false)
        
        // Set analyzing state FIRST and ensure it renders before any parent updates
        console.log('[CustomClothingSelector] Setting analyzing to true')
        setAnalyzing(true)
        analyzingRef.current = true
        
        // Force a synchronous render cycle to ensure analyzing state is visible
        await new Promise<void>((resolve) => {
          // Use multiple animation frames to ensure React processes the update
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setTimeout(() => {
                resolve()
              }, 100)
            })
          })
        })
        
        Telemetry.increment('outfit.analysis.started')

        // Save upload data AFTER spinner is visible (delayed to avoid parent re-render interference)
        // In admin mode: mode='predefined' (admin is setting the preset outfit)
        // In user mode: mode='user-choice' (user is customizing their outfit)
        onChange({
          mode: mode === 'admin' ? 'predefined' : 'user-choice',
          value: {
            assetId: uploadData.assetId,
            outfitS3Key: uploadData.s3Key,
            uploadedAt: new Date().toISOString(),
          },
        })

        // 2. Analyze colors using Gemini

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
            mode: mode === 'admin' ? 'predefined' : 'user-choice',
            value: {
              assetId: uploadData.assetId,
              outfitS3Key: uploadData.s3Key,
              colors: analysisData.colors,
              description: analysisData.description,
              uploadedAt: new Date().toISOString(),
            },
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
      mode: 'predefined',
      value: undefined,
    })
    setPreviewUrl(null)
    setError(null)
  }, [onChange])

  // Determine if upload section should be shown based on mode
  const shouldShowUpload = mode === 'admin'
    ? value.mode === 'predefined'  // Admin mode: show when predefined (admin configures outfit)
    : true  // User mode: always show upload (outfit1 package requires user to upload their outfit)

  // Debug: Log render with analyzing state
  if (analyzing) {
    console.log('[CustomClothingSelector] Component rendering with analyzing=true, shouldShowUpload=', shouldShowUpload)
  }

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
                <CloudArrowUpIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-sm text-gray-600 mb-2">
                  {t('uploadPrompt')}
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

          {/* Analyzing Spinner - shown where results appear */}
          {analyzing && (() => {
            console.log('[CustomClothingSelector] INSIDE shouldShowUpload, rendering spinner, analyzing=', analyzing)
            // Force render by using a ref to check parent
            setTimeout(() => {
              const spinner = document.getElementById('analyzing-spinner-element')
              if (spinner) {
                const parent = spinner.parentElement
                console.log('[CustomClothingSelector] Spinner parent classes:', parent?.className)
                console.log('[CustomClothingSelector] Spinner parent display:', parent ? window.getComputedStyle(parent).display : 'no parent')
                console.log('[CustomClothingSelector] Spinner own display:', window.getComputedStyle(spinner).display)
                console.log('[CustomClothingSelector] Spinner own visibility:', window.getComputedStyle(spinner).visibility)
                console.log('[CustomClothingSelector] Spinner own height:', window.getComputedStyle(spinner).height)
              }
            }, 50)
            return (
              <div 
                data-testid="analyzing-spinner"
                id="analyzing-spinner-element"
                className="text-sm text-gray-700 bg-blue-100 p-6 rounded-lg border-4 border-blue-500 shadow-lg" 
                role="status" 
                aria-live="polite"
                style={{ 
                  display: 'flex',
                  visibility: 'visible',
                  opacity: 1,
                  minHeight: '60px',
                  width: '100%',
                  position: 'relative',
                  zIndex: 9999,
                  backgroundColor: 'rgb(219, 234, 254)',
                  borderColor: 'rgb(59, 130, 246)'
                }}
              >
                <div className="flex items-center justify-center gap-3 w-full">
                  <div className="animate-spin rounded-full h-6 w-6 border-3 border-blue-600 border-t-transparent" style={{ borderWidth: '3px' }} />
                  <p className="text-blue-900 font-bold text-lg">🔍 Analyzing outfit colors...</p>
                </div>
              </div>
            )
          })()}

          {/* Outfit Details - shown after analysis */}
          {value.value?.description && !analyzing && (
            <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
              <p className="font-medium mb-1">Detected outfit:</p>
              <p>{value.value.description}</p>
            </div>
          )}

          {/* Color Swatches - shown after analysis */}
          {value.value?.colors && !analyzing && (
            <div className="flex gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                <div
                  className="w-6 h-6 rounded border border-gray-300"
                  style={{ backgroundColor: value.value.colors.topLayer }}
                  title="Top layer color"
                />
                <span className="text-xs text-gray-500">Top</span>
              </div>
              {value.value.colors.baseLayer && (
                <div className="flex items-center gap-1">
                  <div
                    className="w-6 h-6 rounded border border-gray-300"
                    style={{ backgroundColor: value.value.colors.baseLayer }}
                    title="Base layer color"
                  />
                  <span className="text-xs text-gray-500">Base</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <div
                  className="w-6 h-6 rounded border border-gray-300"
                  style={{ backgroundColor: value.value.colors.bottom }}
                  title="Bottom color"
                />
                <span className="text-xs text-gray-500">Bottom</span>
              </div>
              {value.value.colors.shoes && (
                <div className="flex items-center gap-1">
                  <div
                    className="w-6 h-6 rounded border border-gray-300"
                    style={{ backgroundColor: value.value.colors.shoes }}
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
