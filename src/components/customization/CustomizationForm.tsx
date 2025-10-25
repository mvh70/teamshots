'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import StylePresetSelector from './StylePresetSelector'
import BackgroundSelector from './BackgroundSelector'
import BrandingControls from './BrandingControls'
import CreditCostDisplay from './CreditCostDisplay'
import { PRICING_CONFIG } from '@/config/pricing'

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
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h1 className="text-xl font-semibold text-gray-900">
          {t('title', { default: 'Customize Your Photo' })}
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          {t('subtitle', { default: 'Choose your style, background, and branding options.' })}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
      </div>

      {/* Prominent credit cost display */}
      <CreditCostDisplay
        creditCost={creditCost}
        variant="prominent"
        showRemaining={true}
      />
    </div>
  )
}
