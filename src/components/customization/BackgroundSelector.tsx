'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import Image from 'next/image'

interface BackgroundSelectorProps {
  value: string
  onChange: (value: string) => void
  backgroundPrompt?: string
  onBackgroundPromptChange?: (value: string) => void
  backgroundFile?: File | null
  onBackgroundFileChange?: (file: File | null) => void
  className?: string
}

const backgroundOptions = [
  { value: 'preset-office', labelKey: 'background.preset-office' },
  { value: 'preset-neutral', labelKey: 'background.preset-neutral' },
  { value: 'preset-gradient', labelKey: 'background.preset-gradient' },
  { value: 'preset-branded', labelKey: 'background.preset-branded' },
  { value: 'preset-outdoor', labelKey: 'background.preset-outdoor' },
  { value: 'upload', labelKey: 'background.upload' },
  { value: 'prompt', labelKey: 'background.prompt' }
]

export default function BackgroundSelector({ 
  value, 
  onChange, 
  backgroundPrompt = '',
  onBackgroundPromptChange,
  backgroundFile = null,
  onBackgroundFileChange,
  className = '' 
}: BackgroundSelectorProps) {
  const t = useTranslations('customization')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (backgroundFile) {
      const url = URL.createObjectURL(backgroundFile)
      setPreviewUrl(url)
      
      return () => {
        URL.revokeObjectURL(url)
      }
    } else {
      setPreviewUrl(null)
    }
  }, [backgroundFile])

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
      <h2 className="text-lg font-medium text-gray-900 mb-3">
        {t('background.title', { default: 'Background' })}
      </h2>
      
      {/* Background Type Selection */}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary text-sm"
      >
        {backgroundOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {t(option.labelKey)}
          </option>
        ))}
      </select>

      {/* Background File Upload - Only show when "upload" is selected */}
      {value === 'upload' && onBackgroundFileChange && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('background.backgroundFile', { default: 'Upload Background Image' })}
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onBackgroundFileChange(e.target.files?.[0] || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-brand-primary file:text-white hover:file:bg-brand-primary-hover"
          />
          {backgroundFile && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 mb-2">
                {t('background.selectedFile', { default: 'Selected:' })} {backgroundFile.name}
              </p>
              <div className="relative w-full h-32 bg-gray-100 rounded-lg overflow-hidden">
                {previewUrl && (
                  <Image
                    src={previewUrl}
                    alt="Background preview"
                    width={300}
                    height={128}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Background Prompt - Show for "prompt" option or always for contexts */}
      {(value === 'prompt' || onBackgroundPromptChange) && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('background.backgroundPrompt', { default: 'Background Prompt' })}
          </label>
          <input
            type="text"
            value={backgroundPrompt}
            onChange={(e) => onBackgroundPromptChange?.(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent text-sm"
            placeholder={t('background.backgroundPromptPlaceholder', { default: 'e.g., Modern office with glass windows' })}
          />
        </div>
      )}
    </div>
  )
}
