'use client'

import React from 'react'
import Image from 'next/image'
import { ExclamationTriangleIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/solid'
import { useTranslations } from 'next-intl'
import { getPackageConfig } from '@/domain/style/packages'
import { resolveShotType } from '@/domain/style/elements/shot-type/config'
import type { PhotoStyleSettings } from '@/types/photo-style'

// Legacy interface for backwards compatibility - can receive either format
export interface PhotoStyleSummarySettings {
  background?: {
    mode?: string
    value?: {
      key?: string
      prompt?: string
      type?: string
      color?: string
    }
    key?: string
    prompt?: string
    type?: string
    color?: string
  }
  branding?: {
    mode?: string
    value?: {
      logoKey?: string
      type?: string
      position?: string
    }
    logoKey?: string
    type?: string
    position?: string
  }
  style?: {
    type?: string
    preset?: string
  }
  shotType?: {
    mode?: string
    value?: {
      type?: string
    }
    type?: string
  }
  pose?: {
    mode?: string
    value?: {
      type?: string
    }
    type?: string
  }
}

interface StyleSummaryProps {
  settings?: PhotoStyleSummarySettings | null
  packageId?: string
}

function extractValue<T>(setting: { mode?: string; value?: T } & T | undefined): T | undefined {
  if (!setting) return undefined
  if ('mode' in setting && setting.mode !== undefined) {
    return setting.value as T | undefined
  }
  return setting as T
}

function getThumbnailUrl(key: string): string {
  return `/api/files/get?key=${encodeURIComponent(key)}`
}

export default function StyleSummary({ settings, packageId }: StyleSummaryProps) {
  const t = useTranslations('customization.photoStyle.pose')
  const tShotType = useTranslations('customization.photoStyle.shotType')
  const [showPoseTooltip, setShowPoseTooltip] = React.useState(false)
  const [showShotTypeTooltip, setShowShotTypeTooltip] = React.useState(false)

  const pkg = getPackageConfig(packageId)
  const compositionCategories = pkg.compositionCategories || ['background', 'branding', 'pose']

  const backgroundValue = extractValue(settings?.background)
  const brandingValue = extractValue(settings?.branding)
  const shotTypeValue = extractValue(settings?.shotType)
  const poseValue = extractValue(settings?.pose)

  const isBackgroundUserChoice = settings?.background?.mode === 'user-choice'
  const isBrandingUserChoice = settings?.branding?.mode === 'user-choice'
  const isShotTypeUserChoice = settings?.shotType?.mode === 'user-choice'
  const isPoseUserChoice = settings?.pose?.mode === 'user-choice'

  const backgroundKey = backgroundValue?.key
  const backgroundPrompt = backgroundValue?.prompt
  const backgroundType = isBackgroundUserChoice ? 'user-choice' : backgroundValue?.type
  const backgroundColor = backgroundValue?.color
  const backgroundImageUrl = backgroundKey ? getThumbnailUrl(backgroundKey) : undefined
  const isHexColor = (value?: string): boolean => {
    if (!value) return false
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)
  }

  const logoKey = brandingValue?.logoKey
  const brandingType = isBrandingUserChoice ? 'user-choice' : brandingValue?.type
  const logoPosition = brandingValue?.position

  const showShotType = compositionCategories.includes('shotType')
  const shotType = isShotTypeUserChoice ? 'user-choice' : shotTypeValue?.type
  const shotTypeConfig = shotType && shotType !== 'user-choice' ? resolveShotType(shotType) : undefined

  const poseType = isPoseUserChoice ? 'user-choice' : poseValue?.type

  // Setting row component for consistent styling
  const SettingRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100/80 last:border-0">
      <span className="text-[13px] text-gray-500">{label}</span>
      <div className="text-[13px] text-right">{children}</div>
    </div>
  )

  // User choice indicator
  const UserChoiceIndicator = () => (
    <span className="inline-flex items-center gap-1.5 text-amber-600">
      <ExclamationTriangleIcon className="h-3.5 w-3.5" aria-hidden="true" />
      <span>User choice</span>
    </span>
  )

  return (
    <div className="space-y-0">
      {/* Background */}
      {(backgroundKey || backgroundPrompt || backgroundType) && (
        <SettingRow label="Background">
          {backgroundType === 'gradient' && backgroundColor ? (
            <div className="flex items-center gap-2">
              {isHexColor(backgroundColor) ? (
                <>
                  <span className="text-gray-800 font-medium">Gradient</span>
                  <div
                    className="w-6 h-6 rounded-md border border-gray-200 shadow-sm"
                    style={{ background: `linear-gradient(135deg, ${backgroundColor}, ${backgroundColor}40)` }}
                  />
                </>
              ) : (
                <span className="text-gray-800 font-medium">{backgroundColor}</span>
              )}
            </div>
          ) : backgroundType === 'neutral' && backgroundColor ? (
            <div className="flex items-center gap-2">
              {isHexColor(backgroundColor) ? (
                <>
                  <span className="text-gray-800 font-medium">Solid</span>
                  <div
                    className="w-6 h-6 rounded-md border border-gray-200 shadow-sm"
                    style={{ backgroundColor }}
                  />
                </>
              ) : (
                <span className="text-gray-800 font-medium">{backgroundColor}</span>
              )}
            </div>
          ) : backgroundKey && backgroundImageUrl ? (
            <div className="flex items-center gap-2">
              <span className="text-gray-800 font-medium">Custom</span>
              <Image
                src={backgroundImageUrl}
                alt="Background"
                width={28}
                height={28}
                className="w-7 h-7 rounded-md object-cover border border-gray-200 shadow-sm"
                unoptimized
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              />
            </div>
          ) : backgroundType === 'custom' && !backgroundKey ? (
            <span className="inline-flex items-center gap-1.5 text-red-600">
              <ExclamationTriangleIcon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Missing</span>
            </span>
          ) : backgroundPrompt ? (
            <div className="max-w-[160px]">
              <span className="text-gray-800 font-medium">AI Generated</span>
              <p className="text-[11px] text-gray-400 truncate mt-0.5">{backgroundPrompt}</p>
            </div>
          ) : backgroundType === 'user-choice' ? (
            <UserChoiceIndicator />
          ) : (
            <span className="text-gray-800 font-medium capitalize">{((backgroundType || 'office') as string).replace(/-/g, ' ')}</span>
          )}
        </SettingRow>
      )}

      {/* Branding */}
      {(logoKey || brandingType) && (
        <SettingRow label="Branding">
          {logoKey ? (
            <div className="flex items-center gap-2">
              <span className="text-gray-800 font-medium">Logo{logoPosition && ` · ${logoPosition}`}</span>
              <div className="w-9 h-6 bg-gray-50 rounded border border-gray-200 flex items-center justify-center p-0.5">
                <Image
                  src={getThumbnailUrl(logoKey)}
                  alt="Logo"
                  width={28}
                  height={18}
                  className="max-w-full max-h-full object-contain"
                  unoptimized
                  onError={(e) => {
                    const img = e.currentTarget as HTMLImageElement
                    img.style.display = 'none'
                  }}
                />
              </div>
            </div>
          ) : brandingType === 'user-choice' ? (
            <UserChoiceIndicator />
          ) : (
            <span className="text-gray-800 font-medium">
              {brandingType === 'include' ? 'Included' : 'None'}
            </span>
          )}
        </SettingRow>
      )}

      {/* Shot type */}
      {showShotType && shotType && (
        <SettingRow label="Shot type">
          {shotType === 'user-choice' ? (
            <UserChoiceIndicator />
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <span className="text-gray-800 font-medium">
                {tShotType(`types.${shotType}.label`, {
                  default: shotType.replace(/-/g, ' ')
                })}
              </span>
              {shotTypeConfig?.framingDescription && (
                <button
                  type="button"
                  className="relative inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 rounded"
                  onMouseEnter={() => setShowShotTypeTooltip(true)}
                  onMouseLeave={() => setShowShotTypeTooltip(false)}
                  onFocus={() => setShowShotTypeTooltip(true)}
                  onBlur={() => setShowShotTypeTooltip(false)}
                  aria-label="Shot type information"
                  aria-describedby="shot-type-tooltip"
                >
                  <QuestionMarkCircleIcon className="h-3.5 w-3.5 text-gray-400 hover:text-brand-primary transition-colors" aria-hidden="true" />
                  <span
                    id="shot-type-tooltip"
                    role="tooltip"
                    className={`pointer-events-none absolute right-0 top-full z-50 mt-2 w-52 rounded-lg bg-gray-900 px-3 py-2 text-xs leading-relaxed text-white shadow-xl transition-opacity duration-200 ${showShotTypeTooltip ? 'opacity-100' : 'opacity-0'}`}
                  >
                    {shotTypeConfig.framingDescription}
                  </span>
                </button>
              )}
            </span>
          )}
        </SettingRow>
      )}

      {/* Pose */}
      {poseType && (
        <SettingRow label="Pose">
          {poseType === 'user-choice' ? (
            <UserChoiceIndicator />
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <span className="text-gray-800 font-medium">
                {t(`poses.${poseType}.label`, {
                  default: poseType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                })}
              </span>
              {t(`poses.${poseType}.description`, { default: '' }) && (
                <button
                  type="button"
                  className="relative inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 rounded"
                  onMouseEnter={() => setShowPoseTooltip(true)}
                  onMouseLeave={() => setShowPoseTooltip(false)}
                  onFocus={() => setShowPoseTooltip(true)}
                  onBlur={() => setShowPoseTooltip(false)}
                  aria-label="Pose information"
                  aria-describedby="pose-tooltip"
                >
                  <QuestionMarkCircleIcon className="h-3.5 w-3.5 text-gray-400 hover:text-brand-primary transition-colors" aria-hidden="true" />
                  <span
                    id="pose-tooltip"
                    role="tooltip"
                    className={`pointer-events-none absolute right-0 top-full z-50 mt-2 w-52 rounded-lg bg-gray-900 px-3 py-2 text-xs leading-relaxed text-white shadow-xl transition-opacity duration-200 ${showPoseTooltip ? 'opacity-100' : 'opacity-0'}`}
                  >
                    {t(`poses.${poseType}.description`, { default: '' })}
                  </span>
                </button>
              )}
            </span>
          )}
        </SettingRow>
      )}
    </div>
  )
}
