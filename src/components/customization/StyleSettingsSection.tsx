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
  teamContext?: boolean
  isFreePlan?: boolean
  token?: string // Optional token for invite-based access to custom assets
  mobileExtraSteps?: Parameters<typeof PhotoStyleSettings>[0]['mobileExtraSteps']
  onMobileStepChange?: Parameters<typeof PhotoStyleSettings>[0]['onMobileStepChange']
  onSwipeBack?: () => void // Called when user swipes back from first step (mobile)
  onStepMetaChange?: Parameters<typeof PhotoStyleSettings>[0]['onStepMetaChange']
  /** Optional header to show above the flow header on mobile (e.g., app header with hamburger menu) */
  topHeader?: React.ReactNode
  /** Category key to highlight with pulsing border (desktop only) */
  highlightedField?: string | null
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
  noContainer = false,
  teamContext = false,
  isFreePlan = false,
  token,
  mobileExtraSteps,
  onMobileStepChange,
  onSwipeBack,
  onStepMetaChange,
  topHeader,
  highlightedField
}: StyleSettingsSectionProps) {
  const content = (
    <>
      {title && <h2 className="text-xl font-bold text-gray-900 mb-5 tracking-tight">{title}</h2>}
      {description && (
        <div className="text-sm text-gray-600 mb-7 leading-relaxed">{description}</div>
      )}
      <PhotoStyleSettings
        value={value}
        onChange={onChange}
        readonlyPredefined={readonlyPredefined}
        originalContextSettings={originalContextSettings}
        showToggles={showToggles}
        packageId={packageId}
        teamContext={teamContext}
        isFreePlan={isFreePlan}
        token={token}
        mobileExtraSteps={mobileExtraSteps}
        onMobileStepChange={onMobileStepChange}
        onSwipeBack={onSwipeBack}
        onStepMetaChange={onStepMetaChange}
        topHeader={topHeader}
        highlightedField={highlightedField}
      />
    </>
  )

  if (noContainer) {
    return <div className={className}>{content}</div>
  }

  return (
    <div className={`bg-white rounded-xl shadow-md border border-gray-200/60 p-6 sm:p-8 ${className}`}>
      {content}
    </div>
  )
}


