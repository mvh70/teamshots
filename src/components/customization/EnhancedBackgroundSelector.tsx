'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { PhotoIcon, SwatchIcon, PaintBrushIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import { BackgroundSettings } from '@/types/photo-style'
import { BRAND_CONFIG } from '@/config/brand'

interface EnhancedBackgroundSelectorProps {
  value: BackgroundSettings
  onChange: (settings: BackgroundSettings) => void
  isPredefined?: boolean // If true, user can't change the settings
  isDisabled?: boolean // If true, controls are visually greyed and inactive
  className?: string
  availableBackgrounds?: string[] // Optional: filter backgrounds by package
  showHeader?: boolean
}

const BACKGROUND_TYPES = [
  { value: 'office', label: 'Office Environment', icon: PhotoIcon },
  { value: 'tropical-beach', label: 'Tropical Beach', icon: PhotoIcon },
  { value: 'busy-city', label: 'Busy City', icon: PhotoIcon },
  { value: 'neutral', label: 'Neutral Background', icon: SwatchIcon },
  { value: 'gradient', label: 'Gradient Background', icon: PaintBrushIcon },
  { value: 'custom', label: 'Custom Upload', icon: CloudArrowUpIcon }
] as const

const NEUTRAL_COLORS = [
  '#ffffff', '#fef7f0', '#f0f9ff', '#f0fdf4', '#fefce8',
  '#fdf2f8', '#f5f3ff', '#f0fdfa', '#fff7ed', '#fef3c7',
  '#f3e8ff', '#e0f2fe', '#dcfce7', '#fef3c7', '#fce7f3',
  '#ede9fe', '#ccfbf1', '#fed7aa', '#fde68a', '#f9a8d4'
]

const GRADIENT_COLORS = [
  // Blues & Teals
  '#3b82f6', '#2563eb', '#1d4ed8', '#06b6d4', '#0ea5e9',
  // Greens (using brand config)
  BRAND_CONFIG.colors.secondary, BRAND_CONFIG.colors.secondaryHover, '#16a34a',
  // Purples & Pinks
  '#8b5cf6', '#7c3aed', '#ec4899', '#db2777',
  // Oranges & Yellows (using brand config for CTA)
  '#f59e0b', '#d97706', BRAND_CONFIG.colors.cta, '#ef4444',
  // Browns
  '#8b5e34', '#7c4a2d', '#6d4c41', '#5d4037', '#4e342e',
  // Greys
  '#9ca3af', '#6b7280', '#4b5563', '#374151', '#1f2937', '#111827',
  // Soft pastels
  '#a8edea', '#ffecd2', '#f093fb', '#667eea'
]

export default function EnhancedBackgroundSelector({
  value,
  onChange,
  isPredefined = false,
  isDisabled = false,
  className = '',
  availableBackgrounds,
  showHeader = false
}: EnhancedBackgroundSelectorProps) {
  const t = useTranslations('customization.photoStyle.background')
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showGradientPicker, setShowGradientPicker] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [, setImageLoaded] = useState(false)
  const previewSetRef = useRef<string | null>(null)

  // Filter background types based on package availability
  const filteredBackgroundTypes = availableBackgrounds
    ? BACKGROUND_TYPES.filter(type => availableBackgrounds.includes(type.value))
    : BACKGROUND_TYPES

  const handleTypeChange = (type: BackgroundSettings['type']) => {
    const newSettings: BackgroundSettings = { type }
    
    // Set default values based on type
    switch (type) {
      case 'office':
        newSettings.prompt = value.prompt || 'Modern office environment with professional lighting'
        break
      case 'neutral':
        newSettings.color = value.color || '#ffffff'
        break
      case 'gradient':
        newSettings.color = value.color || '#667eea'
        break
      case 'custom':
        newSettings.key = value.key || ''
        break
    }
    
    onChange(newSettings)
  }

  const handleColorChange = (color: string) => {
    onChange({ ...value, color })
  }

  const handleGradientColorChange = (color: string) => {
    onChange({ ...value, color })
  }

  const handlePromptChange = (prompt: string) => {
    onChange({ ...value, prompt })
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
      
      const res = await fetch('/api/uploads/proxy', {
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
      const newSettings = { ...value, key }
      onChange(newSettings)
    } catch (e) {
      console.error('Background upload failed', e)
      // Keep preview; remove remote key on error
      onChange({ ...value, key: undefined })
    }
  }

  // Clean up preview URL when component unmounts or file changes
  // Set preview URL from existing value when editing
  useEffect(() => {
    const currentKey = value.type === 'custom' ? value.key : null
    
    // Only set preview if key changed and we haven't set it yet
    if (currentKey && previewSetRef.current !== currentKey) {
      setPreviewUrl(`/api/files/get?key=${encodeURIComponent(currentKey)}`)
      setImageLoaded(true)
      previewSetRef.current = currentKey
    } else if (!currentKey && previewSetRef.current) {
      // Clear preview if no key
      setPreviewUrl(null)
      setImageLoaded(false)
      previewSetRef.current = null
    }
  }, [value.type, value.key])

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
            <p className="text-sm text-gray-600">
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
      <div className="space-y-3 mb-6">
        {filteredBackgroundTypes.map((type) => {
          const Icon = type.icon
          const isSelected = value.type === type.value
          
          return (
            <button
              type="button"
              key={type.value}
              onClick={() => !(isPredefined || isDisabled) && handleTypeChange(type.value as BackgroundSettings['type'])}
              disabled={isPredefined || isDisabled}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                isSelected
                  ? 'border-brand-primary bg-brand-primary-light text-brand-primary'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700'
              } ${(isPredefined || isDisabled) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm font-medium">{type.label}</span>
              {isSelected && (
                <div className="ml-auto w-2 h-2 bg-brand-primary rounded-full"></div>
              )}
            </button>
          )
        })}
      </div>

      {/* Type-specific controls */}
      {value.type === 'office' && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            {t('officePrompt', { default: 'Office Description' })}
          </label>
          <textarea
            value={value.prompt || ''}
            onChange={(e) => !(isPredefined || isDisabled) && handlePromptChange(e.target.value)}
            disabled={isPredefined || isDisabled}
            placeholder={t('officePromptPlaceholder', { default: 'Describe the office environment...' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900"
            rows={3}
          />
        </div>
      )}

      {value.type === 'neutral' && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            {t('neutralColor', { default: 'Background Color' })}
          </label>
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-lg border-2 border-gray-300 cursor-pointer"
              style={{ backgroundColor: value.color || '#ffffff' }}
              onClick={() => !(isPredefined || isDisabled) && setShowColorPicker(!showColorPicker)}
            />
            <input
              type="color"
              value={value.color || '#ffffff'}
              onChange={(e) => !(isPredefined || isDisabled) && handleColorChange(e.target.value)}
              disabled={isPredefined || isDisabled}
              className="h-10 w-16 p-1 border border-gray-300 rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <input
              type="text"
              value={value.color || '#ffffff'}
              onChange={(e) => !(isPredefined || isDisabled) && handleColorChange(e.target.value)}
              disabled={isPredefined || isDisabled}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900"
              placeholder="#ffffff"
            />
          </div>
          
          {showColorPicker && !(isPredefined || isDisabled) && (
            <div className="grid grid-cols-10 gap-2 p-3 border border-gray-200 rounded-lg bg-gray-50">
              {NEUTRAL_COLORS.map((color) => (
                <button
                  type="button"
                  key={color}
                  onClick={() => handleColorChange(color)}
                  className="w-8 h-8 rounded border-2 border-gray-300 hover:border-gray-400 transition-colors"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {value.type === 'gradient' && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            {t('gradientColor', { default: 'Gradient Color' })}
          </label>
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-lg border-2 border-gray-300 cursor-pointer"
              style={{
                background: value.color 
                  ? `linear-gradient(135deg, ${value.color}, ${value.color}40)`
                  : '#ffffff'
              }}
              onClick={() => !(isPredefined || isDisabled) && setShowGradientPicker(!showGradientPicker)}
            />
            <input
              type="color"
              value={value.color || '#667eea'}
              onChange={(e) => !(isPredefined || isDisabled) && handleGradientColorChange(e.target.value)}
              disabled={isPredefined || isDisabled}
              className="h-10 w-16 p-1 border border-gray-300 rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <input
              type="text"
              value={value.color || '#667eea'}
              onChange={(e) => !(isPredefined || isDisabled) && handleGradientColorChange(e.target.value)}
              disabled={isPredefined || isDisabled}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900"
              placeholder="#667eea"
            />
          </div>
          
          {showGradientPicker && !(isPredefined || isDisabled) && (
            <div className="grid grid-cols-8 gap-2 p-3 border border-gray-200 rounded-lg bg-gray-50">
              {GRADIENT_COLORS.map((color, index) => (
                <button
                  type="button"
                  key={index}
                  onClick={() => handleGradientColorChange(color)}
                  className="h-12 rounded border-2 border-gray-300 hover:border-gray-400 transition-colors"
                  style={{
                    background: `linear-gradient(135deg, ${color}, ${color}40)`
                  }}
                  title={color}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {value.type === 'custom' && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
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
                <div className="absolute inset-x-0 bottom-0 p-3 flex justify-center bg-gradient-to-t from-black/30 to-transparent">
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
              <div className="p-6">
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
