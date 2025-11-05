'use client'

import { useTranslations } from 'next-intl'

interface StylePresetSelectorProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

const stylePresets = [
  { value: 'corporate', labelKey: 'stylePreset.corporate' },
  { value: 'casual', labelKey: 'stylePreset.casual' },
  { value: 'creative', labelKey: 'stylePreset.creative' },
  { value: 'startup', labelKey: 'stylePreset.startup' },
  { value: 'executive', labelKey: 'stylePreset.executive' }
]

export default function StylePresetSelector({ value, onChange, className = '' }: StylePresetSelectorProps) {
  const t = useTranslations('customization')

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:ring-1 hover:ring-brand-primary border-brand-primary/30 ${className}`}>
      <h2 className="text-lg font-medium text-gray-900 mb-1">
        {t('stylePreset.title', { default: 'Style Preset' })}
      </h2>
      <p className="text-xs text-gray-500 mb-3">{t('stylePreset.helper', { default: 'Choose a preset look. You can still customize background and branding.' })}</p>
      <div className="space-y-2">
        {stylePresets.map((preset) => (
          <label key={preset.value} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="style"
              value={preset.value}
              checked={value === preset.value}
              onChange={(e) => onChange(e.target.value)}
              className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300"
            />
            <span className="text-gray-700">{t(preset.labelKey)}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
