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
  HandRaisedIcon
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
}

type CategoryConfig = {
  key: CategoryType
  label: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  description: string
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
  token
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
        className={`transition-all duration-200 ${
          isPredefined
            ? 'rounded-lg border shadow-sm bg-white border-gray-200'
            : isUserChoice
              ? 'rounded-lg border shadow-sm bg-brand-primary-light border-brand-primary/50 hover:ring-1 hover:ring-brand-primary/60'
              : 'rounded-lg border shadow-sm bg-white border-gray-200'
        }`}
      >
        {/* Category Header */}
        <div
          className={`${
            isPredefined 
              ? 'p-4 border-b border-gray-200' 
              : 'p-5 md:p-4 border-b border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between gap-3 overflow-hidden">
            {/* Left side: Icon, title, and current value */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Icon className="h-6 w-6 md:h-5 md:w-5 text-gray-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base md:text-lg font-semibold text-gray-900">
                    {t(`categories.${category.key}.title`, { default: category.label })}
                  </h3>
                  {/* Help tooltip */}
                  <Tooltip 
                    content={t(`tooltips.${category.key}`, { default: category.description })}
                    position="top"
                  >
                    <QuestionMarkCircleIcon className="h-4 w-4 text-gray-400 hover:text-brand-primary transition-colors" />
                  </Tooltip>
                  {/* Status badge - hide when showToggles is true (admin setting style) */}
                  {!showToggles && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                      isUserChoice ? 'bg-purple-100 text-purple-800' :
                      isLockedByPreset ? 'bg-red-50 text-red-600 border border-red-200' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {isUserChoice ? (
                        <SparklesIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <LockClosedIcon className={`h-3.5 w-3.5 ${isLocked ? 'text-red-600' : ''}`} aria-hidden="true" />
                      )}
                      {chipLabel}
                    </span>
                  )}
                </div>
                {/* Show description */}
                <p className="text-sm text-gray-600 mt-0.5 hidden md:block">
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
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-1 flex-shrink-0"
                  >
                    <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
                      isPredefined ? 'bg-brand-primary' : 'bg-gray-300'
                    }`}>
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        isPredefined ? 'translate-x-5' : 'translate-x-1'
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
                    <QuestionMarkCircleIcon className="h-4 w-4 text-gray-400 hover:text-brand-primary transition-colors" />
                  </Tooltip>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Category Settings */}
        <div className={`${
          isPredefined 
            ? 'p-0 md:p-4' 
            : 'p-5 md:p-4'
        } ${isLockedByPreset ? 'opacity-60' : ''}`}>
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
  const currentEditableCategories = !showToggles ? allCategories.filter(cat => {
    return wasInitiallyEditable.has(cat.key)
  }) : []
  
  const currentLockedCategories = !showToggles ? allCategories.filter(cat => !wasInitiallyEditable.has(cat.key)) : []

  // Locked sections teaser component (Context B only)
  const LockedSectionsTeaser = () => {
    if (showToggles || currentLockedCategories.length === 0 || hasCustomizedEditable) return null

    return (
      <div className="bg-gradient-to-r from-gray-50 to-blue-50 border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-gray-400 to-blue-400 rounded-full flex items-center justify-center">
            <LockClosedIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-1">
              {t('lockedSections.teaser.title', { 
                default: `${currentLockedCategories.length} more settings configured`,
                count: currentLockedCategories.length 
              })}
            </p>
            <p className="text-xs text-gray-600">
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
    <div className={`space-y-6 ${className}`}>
      {/* Context B: Show editable sections, then teaser or revealed locked sections */}
      {!showToggles && currentEditableCategories.length > 0 && (
        <>
          {/* Editable sections with header */}
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-l-4 border-purple-500 rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <SparklesIcon className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-gray-900">
                    {t('sections.customizable', { default: 'Customize Your Style' })}
                  </h2>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {t('sections.customizableDesc', { default: 'Personalize these settings to match your preferences' })}
                  </p>
                </div>
              </div>
            </div>
            <CardGrid>
              {currentEditableCategories.map(renderCategoryCard)}
            </CardGrid>
          </div>
          
          {/* Locked sections teaser or revealed sections */}
          {currentLockedCategories.length > 0 && (
            <>
              <LockedSectionsTeaser />
              {hasCustomizedEditable && (
                <>
                  {/* Locked sections with header */}
                  <div className="space-y-4">
                    <div className="bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 border-2 border-blue-200 rounded-xl p-5 shadow-md">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                          <LockClosedIcon className="h-7 w-7 text-white" />
                        </div>
                        <div className="flex-1">
                          <h2 className="text-xl font-bold text-gray-900 mb-1">
                            {t('sections.preset', { default: 'Team Preset Settings' })}
                          </h2>
                          <p className="text-sm text-gray-700">
                            {t('sections.presetDesc', { default: 'These settings are configured by your team admin' })}
                          </p>
                        </div>
                      </div>
                    </div>
                    <CardGrid>
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
                </>
              )}
            </>
          )}
        </>
      )}

      {/* Context A: Admin setting style - show all categories with sections */}
      {showToggles && (
        <>
          {/* Mobile: All categories in single grid */}
          <div className="md:hidden space-y-4">
            <CardGrid>
              {allCategories.map(renderCategoryCard)}
            </CardGrid>
          </div>

          {/* Desktop: Original order - Photo Style Section */}
          <div className="hidden md:block space-y-4">
            <div id="composition-settings-section" className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 border-l-4 border-brand-primary rounded-lg p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-brand-primary rounded-lg flex items-center justify-center flex-shrink-0">
                  <CameraIcon className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900">
                    {t('sections.composition', { default: 'Composition Settings' })}
                  </h2>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {t('sections.compositionDesc', { default: 'Background, branding, and shot type' })}
                  </p>
                </div>
              </div>
            </div>
            <CardGrid>
              {visiblePhotoCategories.map(renderCategoryCard)}
            </CardGrid>
          </div>

          {/* Desktop: User Style Section */}
          <div className="hidden md:block space-y-4">
            <div id="user-style-settings-section" className="bg-gradient-to-r from-brand-secondary/5 to-brand-primary/5 border-l-4 border-brand-secondary rounded-lg p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-brand-secondary rounded-lg flex items-center justify-center flex-shrink-0">
                  <UserIcon className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900">
                    {t('sections.userStyle', { default: 'User Style Settings' })}
                  </h2>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {t('sections.userStyleDesc', { default: 'Clothing, expression, and lighting preferences' })}
                  </p>
                </div>
              </div>
            </div>
            <CardGrid>
              {visibleUserCategories.map(renderCategoryCard)}
            </CardGrid>
          </div>
        </>
      )}
    </div>
  )
}
