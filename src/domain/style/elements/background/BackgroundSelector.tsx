'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { CloudArrowUpIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import { BackgroundSettings, BackgroundType, BackgroundValue } from '@/types/photo-style'
import { BACKGROUND_TYPES } from './config'
import ColorWheelPicker from '@/components/ui/ColorWheelPicker'
import type { ColorValue } from '@/components/ui/ColorWheelPicker'
import { predefined, userChoice } from '../base/element-types'

interface BackgroundSelectorProps {
  value: BackgroundSettings
  onChange: (settings: BackgroundSettings) => void
  isPredefined?: boolean // If true, user can't change the settings
  isDisabled?: boolean // If true, controls are visually greyed and inactive
  className?: string
  availableBackgrounds?: string[] // Optional: filter backgrounds by package
  showHeader?: boolean
  token?: string // Optional token for invite-based access to custom assets
}

export default function BackgroundSelector({
  value,
  onChange,
  isPredefined = false,
  isDisabled = false,
  className = '',
  availableBackgrounds,
  showHeader = false,
  token
}: BackgroundSelectorProps) {
  const t = useTranslations('customization.photoStyle.background')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [, setImageLoaded] = useState(false)
  const previewSetRef = useRef<string | null>(null)

  // Extract the current value for easier access
  const bgValue = value?.value

  // Helper to preserve mode when updating value
  // CRITICAL: Preserves predefined mode when admin is editing a predefined setting
  const wrapWithCurrentMode = (newValue: BackgroundValue): BackgroundSettings => {
    return value?.mode === 'predefined' ? predefined(newValue) : userChoice(newValue)
  }

  // Filter background types based on package availability
  const filteredBackgroundTypes = availableBackgrounds
    ? BACKGROUND_TYPES.filter(type => availableBackgrounds.includes(type.value))
    : BACKGROUND_TYPES

  const handleTypeChange = (type: BackgroundType) => {
    const newValue: BackgroundValue = { type }

    // Set default values based on type
    switch (type) {
      case 'office':
        newValue.prompt = bgValue?.prompt || 'Modern office environment with professional lighting'
        break
      case 'neutral':
        newValue.color = bgValue?.color || '#ffffff'
        break
      case 'gradient':
        newValue.color = bgValue?.color || '#667eea'
        break
      case 'custom':
        newValue.key = bgValue?.key || ''
        break
    }

    onChange(wrapWithCurrentMode(newValue))
  }

  const handleColorChange = (colorValue: ColorValue) => {
    if (!bgValue) return
    onChange(wrapWithCurrentMode({ ...bgValue, color: colorValue.hex }))
  }

  const handleGradientColorChange = (colorValue: ColorValue) => {
    if (!bgValue) return
    onChange(wrapWithCurrentMode({ ...bgValue, color: colorValue.hex }))
  }

  const handlePromptChange = (prompt: string) => {
    if (!bgValue) return
    onChange(wrapWithCurrentMode({ ...bgValue, prompt }))
  }

  const handleFileUpload = async (file: File | null) => {
    if (!file) return

    // Local preview immediately
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
          'x-file-type': 'background'
        },
        body: file,
        credentials: 'include' // Required for Safari to send cookies
      })
      
      if (!res.ok) {
        const errorText = await res.text()
        console.error('Upload failed:', res.status, errorText)
        throw new Error('Upload failed')
      }

      const { key } = await res.json()

      // Store only the key, not the full URL (same as selfies)
      onChange(wrapWithCurrentMode({ ...bgValue, type: 'custom', key }))
    } catch (e) {
      console.error('Background upload failed', e)
      // Keep preview; remove remote key on error
      onChange(wrapWithCurrentMode({ ...bgValue, type: 'custom', key: undefined }))
    }
  }

  // Sync preview URL from value.key when editing existing backgrounds.
  // This is an intentional prop sync pattern: when the parent provides a saved key,
  // we need to generate the preview URL. The ref tracks processed keys to avoid redundant updates.
  /* eslint-disable react-you-might-not-need-an-effect/no-adjust-state-on-prop-change */
  useEffect(() => {
    const currentKey = bgValue?.type === 'custom' ? bgValue.key : null

    // Only set preview if key changed and we haven't set it yet
    if (currentKey && previewSetRef.current !== currentKey) {
      const tokenParam = token ? `&token=${encodeURIComponent(token)}` : ''
      setPreviewUrl(`/api/files/get?key=${encodeURIComponent(currentKey)}${tokenParam}`)
      setImageLoaded(true)
      previewSetRef.current = currentKey
    } else if (!currentKey && previewSetRef.current) {
      // Clear preview if no key
      setPreviewUrl(null)
      setImageLoaded(false)
      previewSetRef.current = null
    }
  }, [bgValue?.type, bgValue?.key, token])
  /* eslint-enable react-you-might-not-need-an-effect/no-adjust-state-on-prop-change */

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])


  return (
    <div className={`${className}`}>
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {t('title', { default: 'Background' })}
            </h3>
            <p className="hidden md:block text-sm text-gray-600">
              {t('subtitle', { default: 'Choose your background style' })}
            </p>
          </div>
          {isPredefined && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {t('predefined', { default: 'Predefined' })}
            </span>
          )}
        </div>
      )}

      {/* Background Type Selection */}
      <div className={`space-y-4 mb-6 ${
        // Hide entire selection section on mobile when predefined and custom upload is selected
        isPredefined && bgValue?.type === 'custom' ? 'hidden md:block' : ''
      }`}>
        {filteredBackgroundTypes.map((type) => {
          const isSelected = bgValue?.type === type.value
          // On mobile, hide unselected options when predefined
          const shouldHide = isPredefined && !isSelected
          // On mobile, hide custom upload option when predefined
          const hideCustomUpload = isPredefined && type.value === 'custom'
          
          return (
            <div
              key={type.value}
              className={`${shouldHide ? 'hidden md:block' : ''} ${hideCustomUpload ? 'hidden md:block' : ''}`}
            >
              <button
                type="button"
                onClick={() => !(isPredefined || isDisabled) && handleTypeChange(type.value as BackgroundType)}
                disabled={isPredefined || isDisabled}
                className={`w-full bg-gray-50 rounded-lg p-4 border-2 transition-all ${
                  isSelected
                    ? 'border-brand-primary bg-brand-primary-light shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-white hover:shadow-sm'
                } ${(isPredefined || isDisabled) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-2xl ${
                    isSelected 
                      ? `bg-gradient-to-br ${type.color}` 
                      : 'bg-gray-200'
                  }`}>
                    {type.icon}
                  </div>
                  <div className="flex-1 text-left">
                    <div className={`text-sm font-semibold ${isSelected ? 'text-brand-primary' : 'text-gray-900'}`}>
                      {t(`types.${type.value}`)}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 bg-brand-primary rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
              
              {/* Show color picker inline when neutral is selected */}
              {isSelected && type.value === 'neutral' && (
                <div className="mt-3 pl-4 pr-4 pb-2">
                  <ColorWheelPicker
                    value={bgValue?.color || '#ffffff'}
                    onChange={handleColorChange}
                    disabled={isPredefined || isDisabled}
                  />
                </div>
              )}

              {/* Show color picker inline when gradient is selected */}
              {isSelected && type.value === 'gradient' && (
                <div className="mt-3 pl-4 pr-4 pb-2">
                  <ColorWheelPicker
                    value={bgValue?.color || '#667eea'}
                    onChange={handleGradientColorChange}
                    disabled={isPredefined || isDisabled}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Type-specific controls */}
      {bgValue?.type === 'office' && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            {t('officePrompt', { default: 'Office Description' })}
          </label>
          <textarea
            value={bgValue?.prompt || ''}
            onChange={(e) => !(isPredefined || isDisabled) && handlePromptChange(e.target.value)}
            disabled={isPredefined || isDisabled}
            placeholder={t('officePromptPlaceholder', { default: 'Describe the office environment...' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900"
            rows={3}
          />
        </div>
      )}

      {/* Removed separate ColorPickers for neutral and gradient as they are now integrated in the list */}

      {bgValue?.type === 'custom' && (
        <div className="space-y-3">
          <label className={`block text-sm font-medium text-gray-700 ${
            isPredefined ? 'hidden md:block' : ''
          }`}>
            {t('customUpload', { default: 'Upload Background' })}
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-0 text-center relative overflow-hidden">
            {previewUrl ? (
              <div className="relative w-full h-56">
                <Image 
                  src={previewUrl} 
                  alt="Background preview" 
                  width={400}
                  height={224}
                  className="absolute inset-0 w-full h-full object-cover" 
                  onLoad={() => setImageLoaded(true)} 
                  onError={() => setImageLoaded(false)}
                  unoptimized
                />
                <div className={`absolute inset-x-0 bottom-0 p-3 flex justify-center bg-gradient-to-t from-black/30 to-transparent ${
                  isPredefined ? 'hidden md:flex' : ''
                }`}>
                  <label
                    htmlFor="background-upload"
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
                  htmlFor="background-upload"
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
              id="background-upload"
            />
          </div>
          {/* Hide filename/URL under preview per request */}
        </div>
      )}

    </div>
  )
}