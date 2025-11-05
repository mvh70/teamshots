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
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:ring-1 hover:ring-brand-primary border-brand-primary/30 ${className}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-lg font-medium text-gray-900">
            {t('background.title', { default: 'Background' })}
          </h2>
          <div className="mt-1">
            {value?.startsWith('preset-') ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-xs">
                <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 2a4 4 0 00-4 4v2H5a1 1 0 00-1 1v7a2 2 0 002 2h8a2 2 0 002-2V9a1 1 0 00-1-1h-1V6a4 4 0 00-4-4zm-2 6V6a2 2 0 114 0v2H8z"/></svg>
                {t('background.presetChip', { default: 'Locked by preset' })}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-brand-primary-light text-brand-primary text-xs">
                {t('background.customChip', { default: 'Customizable' })}
              </span>
            )}
          </div>
        </div>
        {value?.startsWith('preset-') && (
          <button
            type="button"
            onClick={() => onChange('prompt')}
            className="px-3 py-1.5 text-xs rounded bg-brand-cta text-white hover:bg-brand-cta-hover"
          >
            {t('background.customizeCta', { default: 'Customize my own' })}
          </button>
        )}
      </div>
      
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

      {/* Background Prompt - Show for "prompt" option or always when handler provided */}
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
