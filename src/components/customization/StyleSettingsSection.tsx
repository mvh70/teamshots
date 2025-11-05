import React from 'react'
import PhotoStyleSettings from '@/components/customization/PhotoStyleSettings'
import type { PhotoStyleSettings as PhotoStyleSettingsType } from '@/types/photo-style'

interface StyleSettingsSectionProps {
  title?: string
  description?: React.ReactNode
  value: PhotoStyleSettingsType
  onChange: (next: PhotoStyleSettingsType) => void
  readonlyPredefined?: boolean
  originalContextSettings?: PhotoStyleSettingsType
  showToggles?: boolean
  packageId: string
  className?: string
  noContainer?: boolean
}

export default function StyleSettingsSection({
  title,
  description,
  value,
  onChange,
  readonlyPredefined = false,
  originalContextSettings,
  showToggles = true,
  packageId,
  className = '',
  noContainer = false
}: StyleSettingsSectionProps) {
  const content = (
    <>
      {title && <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>}
      {description && (
        <div className="text-sm text-gray-600 mb-6">{description}</div>
      )}
      <PhotoStyleSettings
        value={value}
        onChange={onChange}
        readonlyPredefined={readonlyPredefined}
        originalContextSettings={originalContextSettings}
        showToggles={showToggles}
        packageId={packageId}
      />
    </>
  )

  if (noContainer) {
    return <div className={className}>{content}</div>
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
      {content}
    </div>
  )
}


