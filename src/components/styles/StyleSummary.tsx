'use client'

import React from 'react'
import Image from 'next/image'
import { ExclamationTriangleIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/solid'
import { resolveShotType } from '@/domain/style/elements/shot-type/config'
import { useTranslations } from 'next-intl'
import { hasValue, isUserChoice } from '@/domain/style/elements/base/element-types'
import type { PhotoStyleSettings } from '@/types/photo-style'

// Legacy interface for backwards compatibility - can receive either format
export interface PhotoStyleSummarySettings {
  background?: {
    // New wrapper format
    mode?: string
    value?: {
      key?: string
      prompt?: string
      type?: string
      color?: string
    }
    // Legacy format (direct properties)
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
}

// Helper to extract value from either wrapper or legacy format
function extractValue<T>(setting: { mode?: string; value?: T } & T | undefined): T | undefined {
  if (!setting) return undefined
  // New wrapper format: has mode property
  if ('mode' in setting && setting.mode !== undefined) {
    return setting.value as T | undefined
  }
  // Legacy format: direct properties
  return setting as T
}

function getThumbnailUrl(key: string): string {
  return `/api/files/get?key=${encodeURIComponent(key)}`
}

export default function StyleSummary({ settings }: StyleSummaryProps) {
  const t = useTranslations('customization.photoStyle.pose')
  const tShotType = useTranslations('customization.photoStyle.shotType')
  const [showPoseTooltip, setShowPoseTooltip] = React.useState(false)

  // Extract values from wrapper format (handles both new and legacy formats)
  const backgroundValue = extractValue(settings?.background)
  const brandingValue = extractValue(settings?.branding)
  const shotTypeValue = extractValue(settings?.shotType)
  const poseValue = extractValue(settings?.pose)

  // Check if settings are user-choice (new format)
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

  // Style preset computed but intentionally not displayed on the summary card
  const shotType = isShotTypeUserChoice ? 'user-choice' : shotTypeValue?.type
  const shotTypeConfig =
    shotType && shotType !== 'user-choice' ? resolveShotType(shotType) : undefined
  const poseType = isPoseUserChoice ? 'user-choice' : poseValue?.type

  return (
    <div className="space-y-5">
      {(backgroundKey || backgroundPrompt || backgroundType) && (
        backgroundType === 'gradient' && backgroundColor ? (
          <div id="style-background" className="flex flex-col space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-800 underline decoration-2 underline-offset-2">Background</span>
            </div>
            <div className="flex items-center gap-3 ml-6">
              {isHexColor(backgroundColor) ? (
                <div
                  className="w-20 h-20 rounded-xl border-2 border-gray-300 shadow-md hover:shadow-lg transition-shadow ring-2 ring-transparent hover:ring-gray-200"
                  style={{ background: `linear-gradient(135deg, ${backgroundColor}, ${backgroundColor}40)` }}
                />
              ) : (
                <span className="text-sm text-gray-700 font-medium">{backgroundColor}</span>
              )}
            </div>
          </div>
        ) : backgroundType === 'neutral' && backgroundColor ? (
          <div id="style-background" className="flex flex-col space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-800 underline decoration-2 underline-offset-2">Background</span>
            </div>
            <div className="flex items-center gap-3 ml-6">
              {isHexColor(backgroundColor) ? (
                <div className="w-20 h-20 rounded-xl border-2 border-gray-300 shadow-md hover:shadow-lg transition-shadow ring-2 ring-transparent hover:ring-gray-200" style={{ backgroundColor }} />
              ) : (
                <span className="text-sm text-gray-700 font-medium">{backgroundColor}</span>
              )}
            </div>
          </div>
        ) : backgroundKey && backgroundImageUrl ? (
          <div id="style-background" className="flex flex-col space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-800 underline decoration-2 underline-offset-2">Background</span>
            </div>
            <div className="flex items-center gap-3 ml-6">
              <div className="relative group">
                <Image
                  src={backgroundImageUrl}
                  alt="Background thumbnail"
                  width={96}
                  height={96}
                  className="w-24 h-24 rounded-xl object-cover border-2 border-gray-300 shadow-md hover:shadow-lg transition-all duration-300 group-hover:scale-105"
                  unoptimized
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                />
                <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            </div>
          </div>
        ) : backgroundType === 'custom' && !backgroundKey ? (
          <div id="style-background" className="flex flex-col space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-800 underline decoration-2 underline-offset-2">Background</span>
            </div>
            <div className="ml-6 text-sm text-red-600 font-medium flex items-center gap-1.5">
              <ExclamationTriangleIcon className="h-4 w-4" />
              <span>Custom background missing</span>
            </div>
          </div>
        ) : backgroundPrompt ? (
          <div id="style-background" className="flex flex-col space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-800 underline decoration-2 underline-offset-2">Background</span>
            </div>
            <div className="ml-6 text-sm text-gray-700 font-medium">AI Generated: <span className="text-gray-600 font-normal">{backgroundPrompt}</span></div>
          </div>
        ) : backgroundType === 'user-choice' ? (
          <div id="style-background" className="flex flex-col space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-800 underline decoration-2 underline-offset-2">Background</span>
            </div>
            <div className="ml-6 text-sm text-gray-600 flex items-center gap-1.5">
              <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
              <span>User choice</span>
            </div>
          </div>
        ) : (
          <div id="style-background" className="flex flex-col space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-800 underline decoration-2 underline-offset-2">Background</span>
            </div>
            <div className="ml-6 text-sm text-gray-700 capitalize font-medium">{((backgroundType || 'office') as string).replace(/-/g, ' ')} style</div>
          </div>
        )
      )}

      {(logoKey || brandingType) && (
        logoKey ? (
          <div id="style-branding" className="flex flex-col space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-800 underline decoration-2 underline-offset-2">Branding</span>
            </div>
            <div className="ml-6">
              <div className="relative group">
                <div className="w-40 h-28 bg-gradient-to-br from-gray-50 to-white rounded-xl border-2 border-gray-300 shadow-md hover:shadow-lg transition-all duration-300 flex items-center justify-center p-4 group-hover:border-brand-primary/30">
                  <Image
                    src={getThumbnailUrl(logoKey)}
                    alt="Logo thumbnail"
                    width={140}
                    height={84}
                    className="max-w-full max-h-full object-contain transition-transform duration-300 group-hover:scale-105"
                    unoptimized
                    onError={(e) => { 
                      const img = e.currentTarget as HTMLImageElement
                      img.style.display = 'none'
                      const parent = img.parentElement
                      if (parent) {
                        parent.innerHTML = '<span class="text-gray-400 text-sm">Logo not available</span>'
                      }
                    }}
                  />
                </div>
              </div>
              {logoPosition && (
                <div className="text-sm text-gray-700 mt-3 font-semibold">Position: <span className="font-normal capitalize text-gray-600">{logoPosition}</span></div>
              )}
            </div>
          </div>
        ) : brandingType === 'user-choice' ? (
          <div id="style-branding" className="flex flex-col space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-800 underline decoration-2 underline-offset-2">Branding</span>
            </div>
            <div className="ml-6 text-sm text-gray-600 flex items-center gap-1.5">
              <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
              <span>User choice</span>
            </div>
          </div>
        ) : (
          <div id="style-branding" className="flex flex-col space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-800 underline decoration-2 underline-offset-2">Branding</span>
            </div>
            <div className="ml-6 text-sm text-gray-700 font-medium">
              {brandingType === 'include' ? 'Logo included' : 'Logo excluded'}
            </div>
          </div>
        )
      )}

      {/* Style preset intentionally not displayed on summary card */}

      {shotType && (
        <div id="style-shot-type" className="flex flex-col space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-800 underline decoration-2 underline-offset-2">Shot type</span>
          </div>
          <div className="ml-6 text-sm capitalize">
            {shotType === 'user-choice' ? (
              <span className="inline-flex items-center gap-1.5">
                <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
                <span className="text-gray-600">User choice</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 text-gray-700 normal-case">
                <span className="font-semibold">
                  {tShotType(`types.${shotType}.label`, {
                    default: shotType.replace(/-/g, ' ')
                  })}
                </span>
                {shotTypeConfig?.framingDescription && (
                  <span className="relative inline-flex group">
                    <QuestionMarkCircleIcon className="h-4 w-4 text-gray-400 hover:text-brand-primary transition-colors cursor-help" />
                    <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2.5 text-xs leading-relaxed text-white opacity-0 shadow-2xl transition-opacity duration-200 group-hover:opacity-100">
                      {shotTypeConfig.framingDescription}
                    </span>
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
      )}

      {poseType && (
        <div id="style-pose" className="flex flex-col space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-800 underline decoration-2 underline-offset-2">Pose</span>
          </div>
          <div className="ml-6 text-sm">
            {poseType === 'user-choice' ? (
              <span className="inline-flex items-center gap-1.5">
                <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
                <span className="text-gray-600">User choice</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 text-gray-700">
                <span className="font-semibold">
                  {t(`poses.${poseType}.label`, {
                    default: poseType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                  })}
                </span>
                {t(`poses.${poseType}.description`, { default: '' }) && (
                  <span
                    className="relative inline-block w-4 h-4"
                    onMouseEnter={() => setShowPoseTooltip(true)}
                    onMouseLeave={() => setShowPoseTooltip(false)}
                  >
                    <QuestionMarkCircleIcon className="h-4 w-4 text-gray-400 hover:text-brand-primary transition-colors cursor-help" />
                    <span className={`pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2.5 text-xs leading-relaxed text-white shadow-2xl transition-opacity duration-200 ${showPoseTooltip ? 'opacity-100' : 'opacity-0'}`}>
                      {t(`poses.${poseType}.description`, { default: '' })}
                    </span>
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


