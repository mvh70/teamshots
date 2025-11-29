'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { 
  PhotoIcon, 
  SwatchIcon, 
  UserIcon, 
  FaceSmileIcon, 
  LightBulbIcon,
  CameraIcon,
  SparklesIcon,
  LockClosedIcon,
  HandRaisedIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowsRightLeftIcon
} from '@heroicons/react/24/outline'
import {
  PhotoStyleSettings as PhotoStyleSettingsType,
  CategoryType,
  DEFAULT_PHOTO_STYLE_SETTINGS,
  ClothingColorSettings,
  ShotTypeSettings,
  PoseSettings
} from '@/types/photo-style'
import BackgroundSelector from '@/domain/style/elements/background/BackgroundSelector'
import ClothingSelector from '@/domain/style/elements/clothing/ClothingSelector'
import ClothingColorSelector from '@/domain/style/elements/clothing-colors/ClothingColorSelector'
import ShotTypeSelector from '@/domain/style/elements/shot-type/ShotTypeSelector'
import BrandingSelector from '@/domain/style/elements/branding/BrandingSelector'
import ExpressionSelector from '@/domain/style/elements/expression/ExpressionSelector'
import PoseSelector from '@/domain/style/elements/pose/PoseSelector'
import { getPackageConfig } from '@/domain/style/packages'
import { applyPosePresetToSettings } from '@/domain/style/elements/pose/config'
import { defaultAspectRatioForShot } from '@/domain/style/elements/aspect-ratio/config'
import { resolveShotType } from '@/domain/style/elements/shot-type/config'
import { WARDROBE_DETAILS, FALLBACK_DETAIL_BY_STYLE, KnownClothingStyle } from '@/domain/style/elements/clothing/config'
import type { ClothingColorKey } from '@/domain/style/elements/clothing-colors/types'
import { CardGrid, Tooltip } from '@/components/ui'
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline'

interface PhotoStyleSettingsProps {
  value: PhotoStyleSettingsType
  onChange: (settings: PhotoStyleSettingsType) => void
  className?: string
  readonlyPredefined?: boolean // If true, predefined fields are read-only
  originalContextSettings?: PhotoStyleSettingsType // Original context settings to determine what was predefined
  showToggles?: boolean // If false, hide toggles entirely (for direct photo definition)
  packageId?: string // Optional package to control visible categories/overrides
  teamContext?: boolean
  isFreePlan?: boolean
  token?: string // Optional token for invite-based access to custom assets
  mobileExtraSteps?: MobileCustomStep[]
  onMobileStepChange?: (step: MobileStep | null, index: number) => void
}

type CategoryConfig = {
  key: CategoryType
  label: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  description: string
}

export type MobileStep = {
  type: 'intro' | 'selfie-tips' | 'custom' | 'editable' | 'locked'
  category?: CategoryConfig
  custom?: MobileCustomStep
}

type MobileCustomStep = {
  id: string
  title: string
  description?: string
  badgeLabel?: string
  badgeVariant?: 'info' | 'success' | 'warning'
  content: React.ReactNode
  isComplete?: boolean
  noBorder?: boolean
}

const PHOTO_STYLE_CATEGORIES: CategoryConfig[] = [
  {
    key: 'background',
    label: 'Background',
    icon: PhotoIcon,
    description: 'Choose background style'
  },
  {
    key: 'branding',
    label: 'Branding',
    icon: SwatchIcon,
    description: 'Logo and branding options'
  },
  {
    key: 'pose',
    label: 'Pose',
    icon: HandRaisedIcon,
    description: 'Body pose and positioning'
  }
]

const USER_STYLE_CATEGORIES: CategoryConfig[] = [
  {
    key: 'clothing',
    label: 'Clothing',
    icon: UserIcon,
    description: 'Clothing style and accessories'
  },
  {
    key: 'clothingColors',
    label: 'Clothing Colors',
    icon: SwatchIcon,
    description: 'Colors for clothing items'
  },
  {
    key: 'expression',
    label: 'Expression',
    icon: FaceSmileIcon,
    description: 'Facial expression and mood'
  },
  {
    key: 'lighting',
    label: 'Lighting',
    icon: LightBulbIcon,
    description: 'Lighting style and mood'
  }
]

export default function PhotoStyleSettings({
  value,
  onChange,
  className = '',
  readonlyPredefined = false,
  originalContextSettings,
  showToggles = true,
  packageId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  teamContext: _teamContext = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isFreePlan = false,
  token,
  mobileExtraSteps,
  onMobileStepChange
}: PhotoStyleSettingsProps) {
  const t = useTranslations('customization.photoStyle')
  const pkg = getPackageConfig(packageId)
  const packageDefaults = React.useMemo(
    () => pkg.defaultSettings || DEFAULT_PHOTO_STYLE_SETTINGS,
    [pkg]
  )

  const { visiblePhotoCategories, visibleUserCategories, allCategories } = React.useMemo(() => {
    // Use package-defined groupings, with defaults for backward compatibility
    const compositionCategoryKeys = pkg.compositionCategories ?? ['background', 'branding', 'pose']
    const userStyleCategoryKeys = pkg.userStyleCategories ?? ['clothing', 'clothingColors', 'expression', 'lighting']
    
    // Filter categories based on package's visibleCategories and groupings
    const visiblePhoto = PHOTO_STYLE_CATEGORIES.filter(c => 
      pkg.visibleCategories.includes(c.key) && compositionCategoryKeys.includes(c.key)
    )
    const visibleUser = USER_STYLE_CATEGORIES.filter(c => 
      pkg.visibleCategories.includes(c.key) && userStyleCategoryKeys.includes(c.key)
    )
    const all = [...visiblePhoto, ...visibleUser]
    return { visiblePhotoCategories: visiblePhoto, visibleUserCategories: visibleUser, allCategories: all }
  }, [pkg])

  // State for tracking customization progress (for locked sections reveal)
  const [hasCustomizedEditable, setHasCustomizedEditable] = React.useState(false)
  const [activeMobileStep, setActiveMobileStep] = React.useState(0)
  const touchStartXRef = React.useRef<number | null>(null)

  const resolvedClothingColors = React.useMemo<ClothingColorSettings>(() => {
    const defaults = packageDefaults.clothingColors
    const current = value.clothingColors
    const defaultColors = defaults?.colors || {}

    if (current) {
      if (current.type === 'user-choice') {
        return {
          type: 'user-choice',
          colors: {
            ...defaultColors,
            ...(current.colors || {})
          }
        }
      }

      return {
        type: 'predefined',
        colors: {
          ...defaultColors,
          ...(current.colors || {})
        }
      }
    }

    if (Object.keys(defaultColors).length > 0) {
      return {
        type: 'user-choice',
        colors: { ...defaultColors }
      }
    }

    return { type: 'user-choice' }
  }, [packageDefaults.clothingColors, value.clothingColors])

  // Compute which clothing color pickers to hide based on shot type and clothing style
  const excludedClothingColors = React.useMemo<ClothingColorKey[]>(() => {
    const exclusions = new Set<ClothingColorKey>()
    
    // Get exclusions from shot type (check value first, then package defaults)
    const shotTypeValue = value.shotType?.type || packageDefaults.shotType?.type
    if (shotTypeValue && shotTypeValue !== 'user-choice') {
      const shotTypeConfig = resolveShotType(shotTypeValue)
      if (shotTypeConfig.excludeClothingColors) {
        shotTypeConfig.excludeClothingColors.forEach(c => exclusions.add(c))
      }
    }
    
    // Get exclusions from clothing style + detail (check value first, then package defaults)
    const clothingStyle = value.clothing?.style || packageDefaults.clothing?.style
    if (clothingStyle && clothingStyle !== 'user-choice') {
      const knownStyle = clothingStyle as KnownClothingStyle
      const styleDetails = WARDROBE_DETAILS[knownStyle]
      // Use explicit detail if set, otherwise use the fallback detail for this style
      const clothingDetail = value.clothing?.details || packageDefaults.clothing?.details || FALLBACK_DETAIL_BY_STYLE[knownStyle]
      const detailConfig = styleDetails?.[clothingDetail]
      if (detailConfig?.excludeClothingColors) {
        detailConfig.excludeClothingColors.forEach(c => exclusions.add(c))
      }
    }
    
    return Array.from(exclusions)
  }, [value.shotType?.type, value.clothing?.style, value.clothing?.details, packageDefaults.shotType?.type, packageDefaults.clothing?.style, packageDefaults.clothing?.details])

  // Auto-reveal locked sections after user customizes editable sections (Context B only)
  React.useEffect(() => {
    if (showToggles || hasCustomizedEditable) return // Skip for admin context or already revealed

    const editable = allCategories.filter(cat => {
      const categorySettings = (value as Record<string, unknown>)[cat.key]
      if (!categorySettings) return true
      if (cat.key === 'clothing') {
        return (categorySettings as { style?: string }).style === 'user-choice'
      }
      return (categorySettings as { type?: string }).type === 'user-choice'
    })

    if (editable.length === 0) return // No editable sections

    // Check if user has made changes to editable sections
    const hasChanges = editable.some(cat => {
      const setting = (value as Record<string, unknown>)[cat.key]
      const defaultSetting = (packageDefaults as Record<string, unknown>)[cat.key]
      return setting && JSON.stringify(setting) !== JSON.stringify(defaultSetting)
    })

    if (hasChanges) {
      setHasCustomizedEditable(true)
    }
  }, [value, allCategories, packageDefaults, hasCustomizedEditable, showToggles])

  const syncAspectRatioWithShotType = React.useCallback(
    (target: PhotoStyleSettingsType, shotTypeSettings?: ShotTypeSettings | null) => {
      if (!shotTypeSettings?.type || shotTypeSettings.type === 'user-choice') {
        return
      }

      const aspectRatioConfig = defaultAspectRatioForShot(shotTypeSettings.type)
      if (target.aspectRatio !== aspectRatioConfig.id) {
        target.aspectRatio = aspectRatioConfig.id
      }
    },
    []
  )

  const handleCategoryToggle = (category: CategoryType, isPredefined: boolean, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    
    const newSettings = { ...value }
    
    if (!(newSettings as Record<string, unknown>)[category]) {
      // Initialize with default values
      const packageDefaultValue = (packageDefaults as Record<string, unknown>)[category]
      const defaultValue = (DEFAULT_PHOTO_STYLE_SETTINGS as Record<string, unknown>)[category]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(newSettings as any)[category] =
        packageDefaultValue !== undefined ? packageDefaultValue : defaultValue
    }
    
    // Update the type based on toggle
    if ((newSettings as Record<string, unknown>)[category]) {
      if (isPredefined) {
        // Set to a predefined value (not user-choice)
        switch (category) {
          case 'background':
            newSettings.background = { type: 'office' }
            break
          case 'branding':
            newSettings.branding = { type: 'include' }
            break
          case 'clothing':
            if (packageDefaults.clothing) {
              newSettings.clothing = { ...packageDefaults.clothing }
            } else {
            newSettings.clothing = { style: 'business' }
            }
            break
          case 'clothingColors':
            if (packageDefaults.clothingColors) {
              newSettings.clothingColors = {
                type: packageDefaults.clothingColors.type,
                colors: { ...packageDefaults.clothingColors.colors }
              }
            } else {
              newSettings.clothingColors = {
                type: 'predefined',
                colors: { topCover: 'navy', topBase: 'white', bottom: 'gray' }
              }
            }
            break
          case 'shotType':
            newSettings.shotType = { type: 'headshot' }
            syncAspectRatioWithShotType(newSettings, newSettings.shotType)
            break
          case 'style':
            newSettings.style = { type: 'preset', preset: 'corporate' }
            break
          case 'expression':
            newSettings.expression = { type: 'neutral_serious' }
            break
          case 'lighting':
            newSettings.lighting = { type: 'natural' }
            break
          case 'pose':
            newSettings.pose = { type: 'power_classic' }
            // Apply pose preset settings
            const poseSettings = applyPosePresetToSettings(newSettings, 'power_classic')
            Object.assign(newSettings, poseSettings)
            break
        }
      } else {
        // Set to user-choice
        switch (category) {
          case 'background':
            newSettings.background = { type: 'user-choice' }
            break
          case 'branding':
            newSettings.branding = { type: 'user-choice' }
            break
          case 'clothing':
            newSettings.clothing = { style: 'user-choice' }
            break
          case 'clothingColors':
            newSettings.clothingColors = { type: 'user-choice' }
            break
          case 'shotType':
            newSettings.shotType = { type: 'user-choice' }
            syncAspectRatioWithShotType(newSettings, newSettings.shotType)
            break
          case 'style':
            newSettings.style = { type: 'user-choice' }
            break
          case 'expression':
            newSettings.expression = { type: 'user-choice' }
            break
          case 'lighting':
            newSettings.lighting = { type: 'user-choice' }
            break
          case 'pose':
            newSettings.pose = { type: 'user-choice' }
            break
        }
      }
    }
    
    onChange(newSettings)
  }

  const handleCategorySettingsChange = (category: CategoryType, settings: unknown) => {
    // When showToggles is true (admin setting style), allow all changes
    // Don't allow changes if in readonly mode and the category is predefined
    // Allow changes to user-choice fields even when readonlyPredefined is true
    if (!showToggles && readonlyPredefined && isCategoryPredefined(category)) {
      return
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newSettings: any = { ...value }
    newSettings[category] = settings
    
    if (category === 'shotType') {
      syncAspectRatioWithShotType(newSettings, settings as ShotTypeSettings)
    } else if (category === 'pose') {
      // Apply pose preset settings when pose is changed
      const poseSettings = settings as { type: string }
      
      // Explicitly update pose setting first to ensure type is preserved
      newSettings.pose = { type: poseSettings.type } as PoseSettings
      
      if (poseSettings?.type && poseSettings.type !== 'user-choice') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updatedSettings = applyPosePresetToSettings(newSettings, poseSettings.type as any)
        Object.assign(newSettings, updatedSettings)
      }
    }
    
    onChange(newSettings)
  }

  const isCategoryPredefined = (category: CategoryType) => {
    // When showToggles is true (admin setting style), always check current value
    // to reflect the admin's active changes, not the original context
    if (showToggles) {
      const categorySettings = (value as Record<string, unknown>)[category]
      if (category === 'clothing') {
        return !!(
          categorySettings && (categorySettings as { style?: string }).style !== 'user-choice'
        )
      }
      return !!(
        categorySettings && (categorySettings as { type?: string }).type !== 'user-choice'
      )
    }

    // If we have original context settings, check if this category was predefined in the original context
    if (originalContextSettings) {
      const originalSettings = (originalContextSettings as Record<string, unknown>)[category]
      if (category === 'clothing') {
        return !!(
          originalSettings && (originalSettings as { style?: string }).style !== 'user-choice'
        )
      }
      if (category === 'pose') {
        return !!(
          originalSettings && (originalSettings as { type?: string }).type !== 'user-choice'
        )
      }
      return !!(
        originalSettings && (originalSettings as { type?: string }).type !== 'user-choice'
      )
    }

    // Fallback to current value logic
    const categorySettings = (value as Record<string, unknown>)[category]
    if (category === 'clothing') {
      return !!(
        categorySettings && (categorySettings as { style?: string }).style !== 'user-choice'
      )
    }
    if (category === 'pose') {
      return !!(
        categorySettings && (categorySettings as { type?: string }).type !== 'user-choice'
      )
    }
    return !!(
      categorySettings && (categorySettings as { type?: string }).type !== 'user-choice'
    )
  }

  const getCategoryStatus = (category: CategoryType) => {
    const categorySettings = (value as Record<string, unknown>)[category]
    if (!categorySettings) return 'not-set'
    if (category === 'clothing') {
      if ((categorySettings as { style?: string }).style === 'user-choice') return 'user-choice'
    } else if (category === 'pose') {
      if ((categorySettings as { type?: string }).type === 'user-choice') return 'user-choice'
    } else {
      if ((categorySettings as { type?: string }).type === 'user-choice') return 'user-choice'
    }
    return 'predefined'
  }


  const renderCategoryCard = (category: CategoryConfig) => {
    const Icon = category.icon
    const status = getCategoryStatus(category.key)
    const isPredefined = isCategoryPredefined(category.key)
    const isUserChoice = status === 'user-choice'
    // When showToggles is true (admin setting style), nothing is locked
    const isLockedByPreset = !showToggles && readonlyPredefined && isPredefined
    const isLocked = isLockedByPreset
    const chipLabel = isUserChoice
      ? t('legend.editableChip', { default: 'Editable' })
      : isLockedByPreset
        ? t('legend.lockedChip', { default: 'Locked' })
        : t('legend.presetChip', { default: 'Preset active' })

    return (
      <div
        key={category.key}
        id={`${category.key}-settings`}
        className={`transition-all duration-300 ease-out ${
          isPredefined
            ? 'rounded-xl border shadow-md bg-white border-gray-200 hover:shadow-lg hover:border-gray-300 hover:-translate-y-0.5'
            : isUserChoice
              ? 'rounded-xl border-2 shadow-lg bg-gradient-to-br from-brand-primary-light/50 to-brand-primary-light/30 border-brand-primary/60 hover:shadow-xl hover:border-brand-primary/80 hover:scale-[1.01] hover:-translate-y-0.5'
              : 'rounded-xl border shadow-md bg-white border-gray-200 hover:shadow-lg hover:border-gray-300 hover:-translate-y-0.5'
        } ${isLockedByPreset ? 'opacity-75' : ''}`}
      >
        {/* Category Header */}
        <div
          className={`${
            isPredefined 
              ? 'p-5 md:p-4 border-b border-gray-200/80' 
              : 'p-5 md:p-4 border-b border-gray-200/80'
          }`}
        >
          <div className="flex items-center justify-between gap-3 overflow-hidden">
            {/* Left side: Icon, title, and current value */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className={`p-2 rounded-lg flex-shrink-0 ${
                isUserChoice 
                  ? 'bg-brand-primary/10' 
                  : isLockedByPreset 
                    ? 'bg-red-50' 
                    : 'bg-gray-50'
              }`}>
                <Icon className={`h-5 w-5 md:h-5 md:w-5 flex-shrink-0 ${
                  isUserChoice 
                    ? 'text-brand-primary' 
                    : isLockedByPreset 
                      ? 'text-red-600' 
                      : 'text-gray-600'
                }`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className={`text-base md:text-lg font-bold ${
                    isUserChoice ? 'text-gray-900' : 'text-gray-900'
                  }`}>
                    {t(`categories.${category.key}.title`, { default: category.label })}
                  </h3>
                  {/* Help tooltip */}
                  <Tooltip 
                    content={t(`tooltips.${category.key}`, { default: category.description })}
                    position="top"
                  >
                    <QuestionMarkCircleIcon className="h-4 w-4 text-gray-400 hover:text-brand-primary transition-all duration-200 cursor-help" />
                  </Tooltip>
                  {/* Status badge - hide when showToggles is true (admin setting style) */}
                  {!showToggles && (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 shadow-sm transition-all duration-200 ${
                      isUserChoice ? 'bg-gradient-to-r from-purple-100 to-blue-100 text-purple-800 border border-purple-200/50' :
                      isLockedByPreset ? 'bg-gradient-to-r from-red-50 to-orange-50 text-red-700 border border-red-200' :
                      'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 border border-gray-200'
                    }`}>
                      {isUserChoice ? (
                        <SparklesIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <LockClosedIcon className={`h-3.5 w-3.5 ${isLocked ? 'text-red-600' : 'text-gray-500'}`} aria-hidden="true" />
                      )}
                      {chipLabel}
                    </span>
                  )}
                </div>
                {/* Show description */}
                <p className="text-sm text-gray-500 mt-1 hidden md:block leading-relaxed">
                  {t(`categories.${category.key}.description`, { default: category.description })}
                </p>
              </div>
            </div>
            {/* Right side: Toggle (admin) */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Toggle switch - show when showToggles is true (admin setting style) */}
              {showToggles && (
                <div className="flex items-center gap-1">
                  <button
                    id={`${category.key}-toggle`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCategoryToggle(category.key, !isPredefined, e)
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 flex-shrink-0"
                  >
                    <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 flex-shrink-0 shadow-inner ${
                      isPredefined ? 'bg-brand-primary shadow-brand-primary/30' : 'bg-gray-300'
                    }`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-all duration-300 ${
                        isPredefined ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </div>
                    <span className={`hidden md:inline ${isPredefined ? 'text-brand-primary' : 'text-gray-600'}`}>
                      {isPredefined
                        ? t('toggle.predefined', { default: 'Predefined' })
                        : t('toggle.userChoice', { default: 'User Choice' })
                      }
                    </span>
                  </button>
                  <Tooltip 
                    content={t('tooltips.predefinedToggle', { default: 'Predefined locks this for all team members. User Choice lets each person customize.' })}
                    position="top"
                  >
                    <QuestionMarkCircleIcon className="h-4 w-4 text-gray-400 hover:text-brand-primary transition-all duration-200 cursor-help" />
                  </Tooltip>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Category Settings */}
        <div className={`${
          isPredefined 
            ? 'p-4 md:p-5' 
            : 'p-5 md:p-5'
        }`}>
          {category.key === 'background' && (
            <BackgroundSelector
              value={value.background || { type: 'user-choice' }}
              onChange={(settings) => handleCategorySettingsChange('background', settings)}
              isPredefined={!showToggles && readonlyPredefined && isPredefined}
              isDisabled={!showToggles && readonlyPredefined && isPredefined}
              availableBackgrounds={pkg.availableBackgrounds}
              showHeader={false}
              token={token}
            />
          )}
          
          {category.key === 'clothing' && (
            <ClothingSelector
              value={value.clothing || { style: 'user-choice' }}
              onChange={(settings) => handleCategorySettingsChange('clothing', settings)}
              isPredefined={!showToggles && readonlyPredefined && isPredefined}
              isDisabled={!showToggles && readonlyPredefined && isPredefined}
            />
          )}

          {category.key === 'clothingColors' && (
            <ClothingColorSelector
              value={resolvedClothingColors}
              onChange={(settings) => handleCategorySettingsChange('clothingColors', settings)}
              isDisabled={!showToggles && readonlyPredefined && isPredefined}
              isPredefined={!showToggles && readonlyPredefined && isPredefined}
              showPredefinedBadge={isPredefined}
              showHeader
              excludeColors={excludedClothingColors}
            />
          )}

          {category.key === 'shotType' && (
            <ShotTypeSelector
              value={value.shotType || { type: 'user-choice' }}
              onChange={(settings) => handleCategorySettingsChange('shotType', settings)}
              isPredefined={!showToggles && readonlyPredefined && isPredefined}
              isDisabled={!showToggles && readonlyPredefined && isPredefined}
            />
          )}
          
          {category.key === 'branding' && (
            <BrandingSelector
              value={value.branding || { type: 'user-choice' }}
              onChange={(settings) => handleCategorySettingsChange('branding', settings)}
              isPredefined={!showToggles && readonlyPredefined && isPredefined}
              isDisabled={!showToggles && readonlyPredefined && isPredefined}
              token={token}
            />
          )}
          
          {category.key === 'expression' && (
            <ExpressionSelector
              value={value.expression || { type: 'user-choice' }}
              onChange={(settings) => handleCategorySettingsChange('expression', settings)}
              isPredefined={!showToggles && readonlyPredefined && isPredefined}
              isDisabled={!showToggles && readonlyPredefined && isPredefined}
              availableExpressions={pkg.availableExpressions}
            />
          )}
          
          {category.key === 'pose' && (
            <PoseSelector
              value={value.pose || { type: 'user-choice' }}
              onChange={(settings) => handleCategorySettingsChange('pose', settings)}
              isPredefined={!showToggles && readonlyPredefined && isPredefined}
              isDisabled={!showToggles && readonlyPredefined && isPredefined}
              availablePoses={pkg.availablePoses}
            />
          )}
          
          {/* Placeholder for other categories */}
          {!['background', 'clothing', 'clothingColors', 'shotType', 'branding', 'expression', 'pose'].includes(category.key) && (
            <div className={`text-center py-8 text-gray-500 ${isUserChoice ? 'pointer-events-none' : ''}`}>
              <p className="text-sm">
                {t('comingSoon', { default: 'Settings for this category coming soon' })}
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderIntroStep = () => (
    <div className="p-5 space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary">
          {t('mobile.intro.kicker', { default: 'Before you dive in' })}
        </p>
        <h3 className="text-xl font-bold text-gray-900 mt-1">
          {t('mobile.intro.title', { default: 'A quick pit stop before the glow-up' })}
        </h3>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          {t('mobile.intro.body', { default: 'You\'re about to customize how your photos look. Each card tweaks one part of the shoot, so swipe through and make it yours.' })}
        </p>
      </div>
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
            <ArrowsRightLeftIcon className="h-5 w-5" />
          </div>
          <p className="text-sm text-gray-700">
            {t('mobile.intro.swipe', { default: 'Swipe right to move forward, left to review. Prefer buttons? The little chevrons below have your back.' })}
          </p>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
            <SparklesIcon className="h-5 w-5" />
          </div>
          <p className="text-sm text-gray-700">
            {t('mobile.intro.editable', { default: 'Sparkles badge means you\'re in charge. Adjust until the vibe matches your story.' })}
          </p>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
            <LockClosedIcon className="h-5 w-5" />
          </div>
          <p className="text-sm text-gray-700">
            {t('mobile.intro.locked', { default: 'Lock badge means your team already set it. Peek, but no touching—consistency matters.' })}
          </p>
        </div>
      </div>
    </div>
  )

  const renderSelfieTipsStep = () => (
    <div className="p-5 space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary">
          {t('mobile.selfieTips.kicker', { default: 'Get the best results' })}
        </p>
        <h3 className="text-xl font-bold text-gray-900 mt-1">
          {t('mobile.selfieTips.title', { default: 'Selfie tips for amazing photos' })}
        </h3>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          {t('mobile.selfieTips.body', { default: 'Great team photos start with great selfies. Here\'s how to nail them.' })}
        </p>
      </div>
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-sm text-gray-700">
            <strong className="text-gray-900">{t('mobile.selfieTips.angles.title', { default: 'Mix up your angles' })}</strong>{' '}
            {t('mobile.selfieTips.angles.desc', { default: '— different positions help our AI understand your face better.' })}
          </p>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-yellow-100 text-yellow-700">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <p className="text-sm text-gray-700">
            <strong className="text-gray-900">{t('mobile.selfieTips.lighting.title', { default: 'Find good lighting' })}</strong>{' '}
            {t('mobile.selfieTips.lighting.desc', { default: '— natural light works best. Avoid harsh shadows on your face.' })}
          </p>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </div>
          <p className="text-sm text-gray-700">
            <strong className="text-gray-900">{t('mobile.selfieTips.distance.title', { default: 'Include one further away' })}</strong>{' '}
            {t('mobile.selfieTips.distance.desc', { default: '— showing your shoulders helps us match body proportions.' })}
          </p>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm text-gray-700">
            <strong className="text-gray-900">{t('mobile.selfieTips.minimum.title', { default: 'Upload at least 2' })}</strong>{' '}
            {t('mobile.selfieTips.minimum.desc', { default: '— more variety = better results. 3-5 selfies is ideal.' })}
          </p>
        </div>
      </div>
    </div>
  )

  // Capture initial value on mount to preserve ordering
  const initialValueRef = React.useRef<PhotoStyleSettingsType | undefined>(undefined)
  if (initialValueRef.current === undefined) {
    initialValueRef.current = value
  }

  // Determine initial editable state based on originalContextSettings or initial value
  // This preserves the ordering even when users make changes
  const wasInitiallyEditable = React.useMemo(() => {
    // Use initialValueRef.current instead of value to avoid dependency on changing value
    const initialSettings = originalContextSettings || initialValueRef.current
    const currentPkg = getPackageConfig(packageId)
    const visiblePhoto = PHOTO_STYLE_CATEGORIES.filter(c => currentPkg.visibleCategories.includes(c.key))
    const visibleUser = USER_STYLE_CATEGORIES.filter(c => currentPkg.visibleCategories.includes(c.key))
    const allCats = [...visiblePhoto, ...visibleUser]
    return new Set(
      allCats
        .filter(cat => {
          const categorySettings = initialSettings ? (initialSettings as Record<string, unknown>)[cat.key] : undefined
          if (!categorySettings) return false
          if (cat.key === 'clothing') {
            return (categorySettings as { style?: string }).style === 'user-choice'
          }
          return (categorySettings as { type?: string }).type === 'user-choice'
        })
        .map(cat => cat.key)
    )
  }, [originalContextSettings, packageId])

  // Separate categories into editable and predefined for mobile reordering
  // Use initial editable state to preserve ordering, not current state
  // Variables removed as they were unused: editableCategories, predefinedCategories

  // For Context B: determine editable and locked sections
  // Use initial editable state to preserve categorization - editable sections stay editable
  // even after user customizes them (they don't move to preset section)
  const currentEditableCategories = React.useMemo(() => {
    if (showToggles) return []
    return allCategories.filter(cat => wasInitiallyEditable.has(cat.key))
  }, [showToggles, allCategories, wasInitiallyEditable])
  
  const currentLockedCategories = React.useMemo(() => {
    if (showToggles) return []
    return allCategories.filter(cat => !wasInitiallyEditable.has(cat.key))
  }, [showToggles, allCategories, wasInitiallyEditable])
  
  const lockedSectionsVisible = currentEditableCategories.length === 0 || hasCustomizedEditable

  const mobileSteps = React.useMemo<MobileStep[]>(() => {
    if (showToggles) return []
    const steps: MobileStep[] = []

    // Step 1: Selfie tips intro
    steps.push({ type: 'selfie-tips' })

    // Step 2: Custom steps (e.g., selfie selection)
    if (mobileExtraSteps?.length) {
      mobileExtraSteps.forEach(step => {
        steps.push({ type: 'custom', custom: step })
      })
    }

    // Step 3: Customization intro (moved after selfie selection)
    steps.push({ type: 'intro' })

    // Remaining steps: style customization categories
    currentEditableCategories.forEach(cat => {
      steps.push({
        category: cat,
        type: 'editable'
      })
    })

    if (lockedSectionsVisible && currentLockedCategories.length > 0) {
      currentLockedCategories.forEach(cat => {
        steps.push({
          category: cat,
          type: 'locked'
        })
      })
    }

    return steps
  }, [showToggles, currentEditableCategories, currentLockedCategories, lockedSectionsVisible, mobileExtraSteps])

  const totalMobileSteps = mobileSteps.length
  const currentMobileStep = mobileSteps[activeMobileStep]
  
  // Steps that count toward "Step X of Y" (exclude intro-type steps)
  const numberedSteps = React.useMemo(() => {
    return mobileSteps.filter(step => step.type !== 'intro' && step.type !== 'selfie-tips')
  }, [mobileSteps])
  
  const totalNumberedSteps = numberedSteps.length
  
  // Get the current step's position in numbered steps (1-indexed), or 0 if not a numbered step
  const currentNumberedStepIndex = React.useMemo(() => {
    if (!currentMobileStep || currentMobileStep.type === 'intro' || currentMobileStep.type === 'selfie-tips') {
      return 0 // Not a numbered step
    }
    const index = numberedSteps.findIndex(step => {
      if (step.type === 'custom' && currentMobileStep.type === 'custom') {
        return step.custom?.id === currentMobileStep.custom?.id
      }
      if (step.category && currentMobileStep.category) {
        return step.category.key === currentMobileStep.category.key
      }
      return false
    })
    return index >= 0 ? index + 1 : 0
  }, [currentMobileStep, numberedSteps])
  
  // Whether the current step should show step numbers
  const isNumberedStep = currentNumberedStepIndex > 0
  
  // Removed unused completedMobileSteps - can be re-added if progress tracking is needed

  React.useEffect(() => {
    setActiveMobileStep(prev => {
      if (mobileSteps.length === 0) {
        return 0
      }
      if (prev >= mobileSteps.length) {
        return Math.max(mobileSteps.length - 1, 0)
      }
      return prev
    })
  }, [mobileSteps.length])
  
  // Track previous step identity to prevent infinite update loops
  // (currentMobileStep contains JSX which creates new objects on every render)
  const prevStepIdentity = React.useRef<{ type: string | null, id: string | null, index: number }>({ type: null, id: null, index: -1 })
  React.useEffect(() => {
    if (onMobileStepChange) {
      const currentType = currentMobileStep?.type ?? null
      const currentId = currentMobileStep?.custom?.id ?? currentMobileStep?.category?.key ?? null
      const prev = prevStepIdentity.current
      
      // Only call callback if the step identity actually changed
      if (prev.type !== currentType || prev.id !== currentId || prev.index !== activeMobileStep) {
        prevStepIdentity.current = { type: currentType, id: currentId, index: activeMobileStep }
        onMobileStepChange(currentMobileStep ?? null, activeMobileStep)
      }
    }
  }, [currentMobileStep, activeMobileStep, onMobileStepChange])

  const handleNextStep = React.useCallback(() => {
    setActiveMobileStep(prev => {
      if (mobileSteps.length === 0) return 0
      return Math.min(prev + 1, mobileSteps.length - 1)
    })
  }, [mobileSteps.length])

  const handlePrevStep = React.useCallback(() => {
    setActiveMobileStep(prev => Math.max(prev - 1, 0))
  }, [])

  const handleDirectStepChange = React.useCallback((index: number) => {
    setActiveMobileStep(prev => {
      if (index < 0 || index >= mobileSteps.length) {
        return prev
      }
      return index
    })
  }, [mobileSteps.length])

  const handleTouchStart = React.useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null
  }, [])

  const handleTouchEnd = React.useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartXRef.current === null) return
    const endX = event.changedTouches[0]?.clientX
    if (typeof endX !== 'number') {
      touchStartXRef.current = null
      return
    }

    const delta = endX - touchStartXRef.current
    touchStartXRef.current = null

    if (Math.abs(delta) < 40) {
      return
    }

    if (delta < 0) {
      handleNextStep()
    } else {
      handlePrevStep()
    }
  }, [handleNextStep, handlePrevStep])

  // Locked sections teaser component (Context B only)
  const LockedSectionsTeaser = () => {
    if (showToggles || currentLockedCategories.length === 0 || hasCustomizedEditable) return null

    return (
      <div className="bg-gradient-to-r from-gray-50 via-blue-50 to-purple-50 border-2 border-dashed border-gray-300 rounded-xl p-8 text-center shadow-sm">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-gray-400 via-blue-400 to-purple-400 rounded-full flex items-center justify-center shadow-md">
            <LockClosedIcon className="h-7 w-7 text-white" />
          </div>
          <div>
            <p className="text-base font-bold text-gray-900 mb-2">
              {t('lockedSections.teaser.title', { 
                default: `${currentLockedCategories.length} more settings configured`,
                count: currentLockedCategories.length 
              })}
            </p>
            <p className="text-sm text-gray-600 leading-relaxed">
              {t('lockedSections.teaser.subtitle', { 
                default: 'Customize the sections above to see what else has been set' 
              })}
            </p>
          </div>
        </div>
      </div>
    )
  }



  return (
    <div className={`space-y-8 ${className}`}>
      {/* Context B: Show editable sections, then teaser or revealed locked sections */}
      {!showToggles && (
        <>
          {/* Mobile swipe experience */}
          <div className="md:hidden space-y-6">
            {mobileSteps.length > 0 ? (
              <div className="space-y-4">
                <div
                  className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100 px-4 sm:px-6 py-4 shadow-sm -mx-4 sm:-mx-6"
                  style={{ top: 'calc(env(safe-area-inset-top, 0px))' }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {currentMobileStep
                          ? currentMobileStep.type === 'locked'
                            ? t('mobile.banner.preset', { default: 'Team preset: {label}', label: currentMobileStep.category ? t(`categories.${currentMobileStep.category.key}.title`, { default: currentMobileStep.category.label }) : '' })
                            : currentMobileStep.type === 'selfie-tips'
                              ? t('mobile.banner.selfieTipsHeading', { default: 'Selfie tips' })
                              : currentMobileStep.type === 'intro'
                              ? t('mobile.banner.introHeading', { default: 'Meet your photo style controls' })
                              : currentMobileStep.type === 'custom' && currentMobileStep.custom
                                ? currentMobileStep.custom.title
                                : t('mobile.banner.customize', { default: 'Customize {label}', label: currentMobileStep.category ? t(`categories.${currentMobileStep.category.key}.title`, { default: currentMobileStep.category.label }) : '' })
                          : t('sections.customizable', { default: 'Customize Your Style' })
                        }
                      </h3>
                    </div>
                    {isNumberedStep && (
                      <div className="text-right flex flex-col items-end gap-1">
                        <p className="text-xs font-semibold text-gray-500">
                          {t('mobile.banner.step', { default: 'Step {current} of {total}', current: currentNumberedStepIndex, total: totalNumberedSteps })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div
                  className="overflow-hidden"
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                  style={{ touchAction: 'pan-y' }}
                >
                  <div
                    className="flex transition-transform duration-300 ease-in-out"
                    style={{ transform: `translateX(-${activeMobileStep * 100}%)` }}
                  >
                    {mobileSteps.map((step, idx) => {
                      const hasNoBorder = step.type === 'custom' && step.custom?.noBorder
                      return (
                        <div key={step.category ? step.category.key : step.custom ? step.custom.id : step.type === 'selfie-tips' ? 'selfie-tips' : `intro-${idx}`} className="w-full flex-shrink-0 px-1 pb-4">
                          <div className={hasNoBorder ? '' : 'rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 shadow-sm'}>
                            {step.type === 'selfie-tips' && renderSelfieTipsStep()}
                            {step.type === 'intro' && renderIntroStep()}
                            {step.type === 'custom' && step.custom ? (
                              <div className={hasNoBorder ? 'space-y-4 py-2' : 'space-y-4 p-4'}>
                                {step.custom.description && (
                                  <p className="text-sm text-gray-600 leading-snug">{step.custom.description}</p>
                                )}
                                {step.custom.content}
                              </div>
                            ) : step.category ? (
                              renderCategoryCard(step.category)
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    disabled={activeMobileStep === 0}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label={t('mobile.controls.previous', { default: 'Previous' })}
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                  </button>
                  <div className="flex items-center gap-2">
                    {mobileSteps.map((_, idx) => (
                      <button
                        key={`mobile-step-dot-${idx}`}
                        type="button"
                        aria-label={t('mobile.controls.step', { default: 'Go to step {index}', index: idx + 1 })}
                        onClick={() => handleDirectStepChange(idx)}
                        className={`h-2.5 w-2.5 rounded-full transition-colors ${
                          idx === activeMobileStep ? 'bg-brand-primary' : 'bg-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    disabled={activeMobileStep >= totalMobileSteps - 1}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-primary text-white shadow-sm hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label={t('mobile.controls.next', { default: 'Next' })}
                  >
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                </div>

                <p className="text-xs text-center text-gray-500">
                  {t('mobile.swipeHint', { default: 'Swipe or tap Next to continue' })}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 p-6 text-center">
                <p className="text-sm text-gray-600">
                  {t('sections.customizableDesc', { default: 'Personalize these settings to match your preferences' })}
                </p>
              </div>
            )}

            {!lockedSectionsVisible && currentLockedCategories.length > 0 && (
              <LockedSectionsTeaser />
            )}
          </div>

          {/* Desktop experience */}
          <div className="hidden md:block space-y-8">
            {currentEditableCategories.length > 0 && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-purple-50 via-blue-50 to-purple-50 border-l-4 border-purple-500 rounded-xl p-5 shadow-md">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                      <SparklesIcon className="h-7 w-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">
                        {t('sections.customizable', { default: 'Customize Your Style' })}
                      </h2>
                      <p className="text-sm md:text-base text-gray-600 leading-relaxed">
                        {t('sections.customizableDesc', { default: 'Personalize these settings to match your preferences' })}
                      </p>
                    </div>
                  </div>
                </div>
                <CardGrid gap="lg">
                  {currentEditableCategories.map(renderCategoryCard)}
                </CardGrid>
              </div>
            )}
            
            {currentLockedCategories.length > 0 && (
              <>
                {currentEditableCategories.length > 0 && <LockedSectionsTeaser />}
                
                {lockedSectionsVisible && (
                  <div className="space-y-6">
                    <div className="bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 border-2 border-blue-200 rounded-xl p-6 shadow-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                          <LockClosedIcon className="h-7 w-7 text-white" />
                        </div>
                        <div className="flex-1">
                          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">
                            {t('sections.preset', { default: 'Team Preset Settings' })}
                          </h2>
                          <p className="text-sm md:text-base text-gray-700 leading-relaxed">
                            {t('sections.presetDesc', { default: 'These settings are configured by your team admin' })}
                          </p>
                        </div>
                      </div>
                    </div>
                    <CardGrid gap="lg">
                      {currentLockedCategories.map((cat, idx) => (
                        <div 
                          key={cat.key}
                          className="animate-fade-in"
                          style={{ animationDelay: `${idx * 100}ms` }}
                        >
                          {renderCategoryCard(cat)}
                        </div>
                      ))}
                    </CardGrid>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Context A: Admin setting style - show all categories with sections */}
      {showToggles && (
        <>
          {/* Mobile: All categories in single grid */}
          <div className="md:hidden space-y-6">
            <CardGrid gap="lg">
              {allCategories.map(renderCategoryCard)}
            </CardGrid>
          </div>

          {/* Desktop: Original order - Photo Style Section */}
          <div className="hidden md:block space-y-6">
            <div id="composition-settings-section" className="bg-gradient-to-r from-brand-primary/10 via-brand-secondary/5 to-brand-primary/10 border-l-4 border-brand-primary rounded-xl p-6 shadow-md">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-brand-primary to-brand-secondary rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <CameraIcon className="h-7 w-7 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">
                    {t('sections.composition', { default: 'Composition Settings' })}
                  </h2>
                  <p className="text-sm md:text-base text-gray-600 leading-relaxed">
                    {t('sections.compositionDesc', { default: 'Background, branding, and shot type' })}
                  </p>
                </div>
              </div>
            </div>
            <CardGrid gap="lg">
              {visiblePhotoCategories.map(renderCategoryCard)}
            </CardGrid>
          </div>

          {/* Desktop: User Style Section */}
          <div className="hidden md:block space-y-6 mt-8">
            <div id="user-style-settings-section" className="bg-gradient-to-r from-brand-secondary/10 via-brand-primary/5 to-brand-secondary/10 border-l-4 border-brand-secondary rounded-xl p-6 shadow-md">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-brand-secondary to-brand-primary rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <UserIcon className="h-7 w-7 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">
                    {t('sections.userStyle', { default: 'User Style Settings' })}
                  </h2>
                  <p className="text-sm md:text-base text-gray-600 leading-relaxed">
                    {t('sections.userStyleDesc', { default: 'Clothing, expression, and lighting preferences' })}
                  </p>
                </div>
              </div>
            </div>
            <CardGrid gap="lg">
              {visibleUserCategories.map(renderCategoryCard)}
            </CardGrid>
          </div>
        </>
      )}
    </div>
  )
}
