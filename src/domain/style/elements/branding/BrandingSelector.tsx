'use client'

import { useEffect, useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { CloudArrowUpIcon } from '@heroicons/react/24/outline'
import { BrandingSettings } from '@/types/photo-style'
import { Grid } from '@/components/ui'
import { BRANDING_POSITIONS } from './config'
import Image from 'next/image'

interface BrandingSelectorProps {
  value: BrandingSettings
  onChange: (settings: BrandingSettings) => void
  isPredefined?: boolean // If true, user can't change the settings
  isDisabled?: boolean // If true, controls are visually greyed and inactive
  className?: string
  showHeader?: boolean
  token?: string // Optional token for invite-based access to custom assets
}


export default function BrandingSelector({
  value,
  onChange,
  isPredefined = false,
  isDisabled = false,
  className = '',
  showHeader = false,
  token
}: BrandingSelectorProps) {
  const t = useTranslations('customization.photoStyle.branding')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [, setImageLoaded] = useState(false)
  const previewSetRef = useRef<string | null>(null)

  const handleTypeChange = (type: BrandingSettings['type']) => {
    const newSettings: BrandingSettings = { 
      type,
      position: value.position // Preserve position when toggling type
    }
    
    // Set default values based on type
    switch (type) {
      case 'include':
        newSettings.logoKey = value.logoKey || ''
        break
      case 'exclude':
        // No additional settings needed
        break
    }
    
    onChange(newSettings)
  }

  const handleFileUpload = async (file: File | null) => {
    if (!file) return
    const localUrl = URL.createObjectURL(file)
    setPreviewUrl(localUrl)
    setImageLoaded(true)

    try {
      // Use the same upload method as selfies (proxy endpoint)
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      
      // Include token in URL if provided (for invite-based access)
      const uploadUrl = token 
        ? `/api/uploads/proxy?token=${encodeURIComponent(token)}`
        : '/api/uploads/proxy'
      
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'x-file-content-type': file.type,
          'x-file-extension': ext,
          'x-file-type': 'logo'
        },
        body: file,
        credentials: 'include' // Required for Safari to send cookies
      })
      
      if (!res.ok) {
        throw new Error('Upload failed')
      }
      
      const { key } = await res.json()
      
      // Store only the key, not the full URL (same as selfies)
      onChange({ ...value, logoKey: key })
    } catch (e) {
      console.error('Logo upload failed', e)
      onChange({ ...value, logoKey: undefined })
    }
  }

  // Clean up preview URL when component unmounts or file changes
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])


  const handlePositionChange = (position: BrandingSettings['position']) => {
    onChange({ ...value, position })
  }

  // Sync preview URL from value.logoKey when editing existing logos.
  // This is an intentional prop sync pattern: when the parent provides a saved logoKey,
  // we need to generate the preview URL. The ref tracks processed keys to avoid redundant updates.
  /* eslint-disable react-you-might-not-need-an-effect/no-adjust-state-on-prop-change */
  useEffect(() => {
    // Only set preview if logoKey changed and we haven't set it yet
    if (value.logoKey && previewSetRef.current !== value.logoKey) {
      const tokenParam = token ? `&token=${encodeURIComponent(token)}` : ''
      const url = `/api/files/get?key=${encodeURIComponent(value.logoKey)}${tokenParam}`
      setPreviewUrl(url)
      setImageLoaded(false) // Reset to false, will be set to true on successful load
      previewSetRef.current = value.logoKey
    } else if (!value.logoKey && previewSetRef.current) {
      // Clear preview if no logoKey
      setPreviewUrl(null)
      setImageLoaded(false)
      previewSetRef.current = null
    }
  }, [value.logoKey, token])
  /* eslint-enable react-you-might-not-need-an-effect/no-adjust-state-on-prop-change */

  return (
    <div className={`${className}`}>
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {t('title', { default: 'Branding' })}
            </h3>
            <p className="hidden md:block text-sm text-gray-600">
              {t('subtitle', { default: 'Choose logo and branding options' })}
            </p>
          </div>
          {isPredefined && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {t('predefined', { default: 'Predefined' })}
            </span>
          )}
        </div>
      )}

      {/* Include Logo Toggle */}
      <div className={`mb-6 ${isPredefined ? 'hidden md:block' : ''}`}>
        <button
          type="button"
          onClick={() => !(isPredefined || isDisabled) && handleTypeChange(value.type === 'include' ? 'exclude' : 'include')}
          disabled={isPredefined || isDisabled}
          className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            (isPredefined || isDisabled) ? 'cursor-not-allowed opacity-60' : ''
          }`}
        >
          <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            value.type === 'include' ? 'bg-brand-primary' : 'bg-gray-300'
          }`}>
            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
              value.type === 'include' ? 'translate-x-5' : 'translate-x-1'
            }`} />
          </div>
          <span className={value.type === 'include' ? 'text-brand-primary' : 'text-gray-600'}>
            {value.type === 'include' 
              ? t('include', { default: 'Include Logo' })
              : t('exclude', { default: 'No Logo' })}
          </span>
        </button>
      </div>

      {/* Toggle include/exclude via buttons above; when include is active, show upload and position */}
      {value.type === 'include' && (
        <div className="space-y-3">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-0 text-center relative overflow-hidden">
            {previewUrl ? (
              <div className="relative w-full h-56">
                <img 
                  src={previewUrl} 
                  alt="Logo preview" 
                  className="absolute inset-0 w-full h-full object-contain" 
                  onLoad={() => {
                    setImageLoaded(true)
                  }} 
                  onError={async (e) => {
                    setImageLoaded(false)
                    // Try to fetch the URL to get more error details
                    try {
                      const response = await fetch(previewUrl, { method: 'HEAD' })
                      console.error('[BrandingSelector] Failed to load logo preview:', {
                        url: previewUrl,
                        status: response.status,
                        statusText: response.statusText,
                        logoKey: value.logoKey
                      })
                    } catch (fetchError) {
                      console.error('[BrandingSelector] Failed to load logo preview:', {
                        url: previewUrl,
                        logoKey: value.logoKey,
                        error: fetchError instanceof Error ? fetchError.message : String(fetchError)
                      })
                    }
                  }}
                />
                <div className={`absolute inset-x-0 bottom-0 p-3 flex justify-center bg-gradient-to-t from-black/30 to-transparent ${
                  isPredefined ? 'hidden md:flex' : ''
                }`}>
                  <label
                    htmlFor="logo-upload"
                    className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md ${
                      (isPredefined || isDisabled)
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                        : 'bg-brand-primary text-white hover:bg-brand-primary-hover cursor-pointer'
                    }`}
                  >
                    {t('chooseFile', { default: 'Choose File' })}
                  </label>
                </div>
              </div>
            ) : (
              <div className={`p-6 ${isPredefined ? 'hidden md:block' : ''}`}>
                <CloudArrowUpIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-sm text-gray-600 mb-2">
                  {t('uploadPrompt', { default: 'Click to upload or drag and drop' })}
                </p>
                <label
                  htmlFor="logo-upload"
                  className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md ${
                    (isPredefined || isDisabled)
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-brand-primary text-white hover:bg-brand-primary-hover cursor-pointer'
                  }`}
                >
                  {t('chooseFile', { default: 'Choose File' })}
                </label>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => !(isPredefined || isDisabled) && handleFileUpload(e.target.files?.[0] || null)}
              disabled={isPredefined || isDisabled}
              className="hidden"
              id="logo-upload"
            />
          </div>
          {/* Hide filename/URL under preview per request */}

          {/* Position selector */}
          <div className="space-y-2">
            {isPredefined ? (
              <div className="md:hidden">
                <div className="text-sm font-medium text-gray-700">
                  {value.position === 'background' && t('position.background', { default: 'Background' })}
                  {value.position === 'clothing' && t('position.clothing', { default: 'Clothing' })}
                  {value.position === 'elements' && t('position.elements', { default: 'Other elements' })}
                </div>
              </div>
            ) : (
              <label className="block text-sm font-medium text-gray-700">
                {t('position.label', { default: 'Logo Position' })}
              </label>
            )}
            <div className={isPredefined ? 'hidden md:block' : ''}>
              <Grid cols={{ mobile: 1, tablet: 3 }} gap="sm">
                {BRANDING_POSITIONS.map(opt => {
                  const isSelected = value.position === opt.key
                  // On mobile, hide unselected options when predefined
                  const shouldHide = isPredefined && !isSelected
                  
                  return (
                  <button
                    type="button"
                    key={opt.key}
                    onClick={() => !(isPredefined || isDisabled) && handlePositionChange(opt.key as BrandingSettings['position'])}
                    disabled={isPredefined || isDisabled}
                    className={`w-full px-3 py-2 rounded-md border text-sm transition-colors ${
                      value.position === opt.key
                        ? 'border-brand-primary bg-brand-primary-light text-brand-primary'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700'
                      } ${(isPredefined || isDisabled) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${
                        shouldHide ? 'hidden md:block' : ''
                      }`}
                  >
                    {t(`position.${opt.key}`)}
                  </button>
                  )
                })}
              </Grid>
              
              {/* Show preview image for selected position */}
              {value.position && (() => {
                const imageMap: Record<string, string> = {
                  'background': 'branding-background.png',
                  'clothing': 'branding-clothing.png',
                  'elements': 'branding-other.png'
                }
                const imageSrc = `/images/branding/${imageMap[value.position]}`
                
                return (
                  <div className="mt-4 rounded-md overflow-hidden border border-gray-200">
                    <Image
                      src={imageSrc}
                      alt={t(`position.${value.position}`)}
                      width={600}
                      height={400}
                      className="w-full h-auto object-cover"
                    />
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {value.type === 'exclude' && (
        <div className="text-center py-4">
          <p className="text-sm text-gray-600">
            {t('noLogoMessage', { default: 'No logo will be included in the photos' })}
          </p>
        </div>
      )}
    </div>
  )
}

