'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { PRICING_CONFIG } from '@/config/pricing'
import { calculatePhotosFromCredits } from '@/domain/pricing'

interface BrandingControlsProps {
  includeLogo: boolean
  onIncludeLogoChange: (value: boolean) => void
  logoFile?: File | null
  onLogoFileChange?: (file: File | null) => void
  creditCost?: number
  onGenerate?: () => void
  generateButtonText?: string
  className?: string
}

export default function BrandingControls({
  includeLogo,
  onIncludeLogoChange,
  logoFile = null,
  onLogoFileChange,
  creditCost = PRICING_CONFIG.credits.perGeneration,
  onGenerate,
  generateButtonText = 'Generate',
  className = ''
}: BrandingControlsProps) {
  const t = useTranslations('customization')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Convert credits to photos for display
  const photoCost = calculatePhotosFromCredits(creditCost)

  useEffect(() => {
    if (logoFile) {
      const url = URL.createObjectURL(logoFile)
      setPreviewUrl(url)
      
      return () => {
        URL.revokeObjectURL(url)
      }
    } else {
      setPreviewUrl(null)
    }
  }, [logoFile])

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:ring-1 hover:ring-brand-primary border-brand-primary/30 ${className}`}>
      <h2 className="text-lg font-medium text-gray-900 mb-1">
        {t('branding.title', { default: 'Branding' })}
      </h2>
      <p className="text-xs text-gray-500 mb-3">{t('branding.helper', { default: 'Optional: add your logo placement variations.' })}</p>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={includeLogo}
          onChange={(e) => onIncludeLogoChange(e.target.checked)}
          className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded"
        />
        <span className="text-gray-700">
          {t('branding.includeLogo', { default: 'Include team logo placement variations' })}
        </span>
      </label>

      {/* Logo File Upload - Only show when includeLogo is checked */}
      {includeLogo && onLogoFileChange && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('branding.logoFile', { default: 'Upload Logo' })}
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onLogoFileChange(e.target.files?.[0] || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-brand-primary file:text-white hover:file:bg-brand-primary-hover"
          />
          {logoFile && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 mb-2">
                {t('branding.selectedFile', { default: 'Selected:' })} {logoFile.name}
              </p>
              <div className="relative w-full h-24 bg-gray-100 rounded-lg overflow-hidden">
                {previewUrl && (
                  <Image
                    src={previewUrl}
                    alt="Logo preview"
                    width={300}
                    height={96}
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-gray-500 mt-2">
        {t('branding.cost', { default: 'Cost' })}: {photoCost} {photoCost === 1 ? t('photo', { default: 'photo' }) : t('photos', { default: 'photos' })}
      </p>
      {onGenerate && (
        <button
          onClick={onGenerate}
          className="mt-4 px-4 py-2 rounded-md bg-brand-primary text-white hover:bg-brand-primary-hover text-sm"
        >
          {generateButtonText} ({photoCost} {photoCost === 1 ? t('photo', { default: 'photo' }) : t('photos', { default: 'photos' })})
        </button>
      )}
    </div>
  )
}
