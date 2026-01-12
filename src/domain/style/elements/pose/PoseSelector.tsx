'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import type { PoseSettings, PoseType, LegacyPoseSettings } from './types'
import { getPoseUIInfo } from './config'
import { ImagePreview } from '@/components/ui/ImagePreview'
import { hasValue, userChoice } from '../base/element-types'

interface PoseSelectorProps {
  value: PoseSettings | LegacyPoseSettings
  onChange: (settings: PoseSettings) => void
  isPredefined?: boolean
  isDisabled?: boolean
  className?: string
  showHeader?: boolean
  availablePoses?: string[]
}

// Get poses from the single source of truth
const POSES = getPoseUIInfo().map(pose => ({
  ...pose,
  // Default color since categories are removed
  color: 'from-gray-500 to-gray-600'
}))

const POSES_WITH_IMAGES = [
  'candid_over_shoulder',
  'classic_corporate',
  'power_cross',
  'seated_engagement',
  'slimming_three_quarter'
] as const

function hasPoseImage(poseId: string): boolean {
  return POSES_WITH_IMAGES.includes(poseId as typeof POSES_WITH_IMAGES[number])
}

/**
 * Extract pose type from settings, handling both legacy and new formats
 */
function getPoseTypeFromSettings(value: PoseSettings | LegacyPoseSettings | undefined): PoseType | undefined {
  if (!value) return undefined

  // New format: { mode: '...', value?: { type: '...' } }
  if ('mode' in value) {
    const newValue = value as PoseSettings
    if (hasValue(newValue)) {
      return newValue.value.type
    }
    return undefined
  }

  // Legacy format: { type: '...' }
  const legacyValue = value as LegacyPoseSettings
  if (legacyValue.type === 'user-choice') {
    return undefined
  }
  return legacyValue.type
}

export default function PoseSelector({
  value,
  onChange,
  isPredefined = false,
  isDisabled = false,
  className = '',
  showHeader = false,
  availablePoses
}: PoseSelectorProps) {
  const t = useTranslations('customization.photoStyle.pose')

  // Show all poses enabled in the active package (respects availablePoses prop)
  // Do NOT filter by image availability
  const visiblePoses = availablePoses
    ? POSES.filter(p => availablePoses.includes(p.value))
    : POSES

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (isPredefined) return
    const selectedType = event.target.value as PoseType
    // Emit new format, keeping mode as user-choice since user is selecting
    onChange(userChoice({ type: selectedType }))
  }

  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  // Get current pose type, handling both formats
  const currentPoseType = getPoseTypeFromSettings(value)

  // Find the currently selected pose to show its description
  const selectedPose = currentPoseType ? visiblePoses.find(p => p.value === currentPoseType) : undefined

  // For the select value, use first available pose if none selected
  const selectValue = currentPoseType || (visiblePoses[0]?.value ?? 'classic_corporate')

  return (
    <div className={`${className}`}>
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {t('title', { default: 'Pose' })}
            </h3>
            <p className="hidden md:block text-sm text-gray-600">
              {t('subtitle', { default: 'Choose a body pose and positioning' })}
            </p>
          </div>
          {isPredefined && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {t('predefined', { default: 'Predefined' })}
            </span>
          )}
        </div>
      )}

      <div className={`space-y-4 ${isDisabled ? 'opacity-60 pointer-events-none' : ''}`}>
        <div className="relative">
          <select
            value={selectValue}
            onChange={handleChange}
            disabled={isPredefined || isDisabled}
            className={`block w-full rounded-lg border-2 border-gray-200 p-3 pr-10 text-base focus:border-brand-primary focus:outline-none focus:ring-brand-primary sm:text-sm ${
              (isPredefined || isDisabled) ? 'cursor-not-allowed bg-gray-50' : 'cursor-pointer bg-white'
            }`}
          >
            {visiblePoses.map((pose) => (
              <option key={pose.value} value={pose.value}>
                {t(`poses.${pose.value}.label`)}
              </option>
            ))}
          </select>
        </div>

        {/* Selected Pose Description */}
        {selectedPose && (
          <p className="text-sm text-gray-600 px-1">
            {t(`poses.${selectedPose.value}.description`)}
          </p>
        )}

        {/* Conditional Image Preview */}
        {currentPoseType && hasPoseImage(currentPoseType) && (
          <div className="mt-4">
            <ImagePreview
              key={currentPoseType} // Force re-render on value change
              src={`/images/poses/${currentPoseType}.png`}
              alt={t(`poses.${currentPoseType}.label`)}
              width={400}
              height={300}
              variant="preview"
              className="w-full h-auto object-cover rounded-lg shadow-sm border border-gray-200"
              priority={true} // Add priority to ensure it loads immediately
              unoptimized={true} // Ensure we bypass optimization to avoid stale cache or loading issues
            />
          </div>
        )}
      </div>
    </div>
  )
}
