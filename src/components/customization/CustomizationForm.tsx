'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import StylePresetSelector from './StylePresetSelector'
import BackgroundSelector from './BackgroundSelector'
import BrandingControls from './BrandingControls'
import CreditCostDisplay from './CreditCostDisplay'
import { PRICING_CONFIG } from '@/config/pricing'
import { CardGrid } from '@/components/ui'

interface CustomizationFormProps {
  initialValues?: {
    stylePreset?: string
    background?: string
    includeLogo?: boolean
    backgroundPrompt?: string
    backgroundFile?: File | null
    logoFile?: File | null
  }
  onValuesChange?: (values: {
    stylePreset: string
    background: string
    includeLogo: boolean
    backgroundPrompt: string
    backgroundFile: File | null
    logoFile: File | null
  }) => void
  showGenerateButton?: boolean
  onGenerate?: (values: {
    stylePreset: string
    background: string
    includeLogo: boolean
    backgroundPrompt: string
    backgroundFile: File | null
    logoFile: File | null
  }) => void
  generateButtonText?: string
  creditCost?: number
  className?: string
}

export default function CustomizationForm({
  initialValues = {},
  onValuesChange,
  showGenerateButton = true,
  onGenerate,
  generateButtonText = 'Generate',
  creditCost = PRICING_CONFIG.credits.perGeneration,
  className = ''
}: CustomizationFormProps) {
  const t = useTranslations('customization')
  
  const [stylePreset, setStylePreset] = useState(initialValues.stylePreset || 'corporate')
  const [background, setBackground] = useState(initialValues.background || 'preset-office')
  const [includeLogo, setIncludeLogo] = useState(initialValues.includeLogo ?? true)
  const [backgroundPrompt, setBackgroundPrompt] = useState(initialValues.backgroundPrompt || '')
  const [backgroundFile, setBackgroundFile] = useState<File | null>(initialValues.backgroundFile || null)
  const [logoFile, setLogoFile] = useState<File | null>(initialValues.logoFile || null)

  const updateValues = () => {
    onValuesChange?.({
      stylePreset,
      background,
      includeLogo,
      backgroundPrompt,
      backgroundFile,
      logoFile
    })
  }

  const handleStylePresetChange = (value: string) => {
    setStylePreset(value)
    updateValues()
  }

  const handleBackgroundChange = (value: string) => {
    setBackground(value)
    updateValues()
  }

  const handleIncludeLogoChange = (value: boolean) => {
    setIncludeLogo(value)
    updateValues()
  }

  const handleBackgroundPromptChange = (value: string) => {
    setBackgroundPrompt(value)
    updateValues()
  }

  const handleBackgroundFileChange = (file: File | null) => {
    setBackgroundFile(file)
    updateValues()
  }

  const handleLogoFileChange = (file: File | null) => {
    setLogoFile(file)
    updateValues()
  }

  const handleGenerate = () => {
    onGenerate?.({
      stylePreset,
      background,
      includeLogo,
      backgroundPrompt,
      backgroundFile,
      logoFile
    })
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Legend */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-brand-primary-light" />
            <span className="text-gray-600">{t('legend.editable', { default: 'Editable' })}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-gray-600">
              <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 2a4 4 0 00-4 4v2H5a1 1 0 00-1 1v7a2 2 0 002 2h8a2 2 0 002-2V9a1 1 0 00-1-1h-1V6a4 4 0 00-4-4zm-2 6V6a2 2 0 114 0v2H8z"/></svg>
              {t('legend.locked', { default: 'Locked by preset' })}
            </span>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h1 className="text-xl font-semibold text-gray-900">
          {t('title', { default: 'Customize Your Photo' })}
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          {t('subtitle', { default: 'Highlighted sections are editable. Locked items are set by your preset.' })}
        </p>
      </div>

      <CardGrid gap="lg">
        <StylePresetSelector
          value={stylePreset}
          onChange={handleStylePresetChange}
        />

        <BackgroundSelector
          value={background}
          onChange={handleBackgroundChange}
          backgroundPrompt={backgroundPrompt}
          onBackgroundPromptChange={handleBackgroundPromptChange}
          backgroundFile={backgroundFile}
          onBackgroundFileChange={handleBackgroundFileChange}
        />

        <BrandingControls
          includeLogo={includeLogo}
          onIncludeLogoChange={handleIncludeLogoChange}
          logoFile={logoFile}
          onLogoFileChange={handleLogoFileChange}
          creditCost={creditCost}
          onGenerate={showGenerateButton ? handleGenerate : undefined}
          generateButtonText={generateButtonText}
        />
      </CardGrid>

      {/* Prominent credit cost display */}
      <CreditCostDisplay
        creditCost={creditCost}
        variant="prominent"
        showRemaining={true}
      />
    </div>
  )
}
