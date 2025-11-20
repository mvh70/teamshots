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
  LockClosedIcon
} from '@heroicons/react/24/outline'
import {
  PhotoStyleSettings as PhotoStyleSettingsType,
  CategoryType,
  DEFAULT_PHOTO_STYLE_SETTINGS,
  ClothingColorSettings,
  ShotTypeSettings
} from '@/types/photo-style'
import EnhancedBackgroundSelector from './EnhancedBackgroundSelector'
import ClothingStyleSelector from './ClothingStyleSelector'
import ClothingColorSelector from './ClothingColorSelector'
import ShotTypeSelector from './ShotTypeSelector'
import BrandingSelector from './BrandingSelector'
import ExpressionSelector from './ExpressionSelector'
import { getPackageConfig } from '@/domain/style/packages'
import { defaultAspectRatioForShot } from '@/domain/style/packages/aspect-ratios'
import { CardGrid } from '@/components/ui'

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
    key: 'shotType',
    label: 'Shot Type',
    icon: CameraIcon,
    description: 'Photo framing'
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
  // All categories are always expanded per UX requirement
  const pkg = getPackageConfig(packageId)
  const packageDefaults = React.useMemo(
    () => pkg.defaultSettings || DEFAULT_PHOTO_STYLE_SETTINGS,
    [pkg]
  )

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
    
    if (!newSettings[category]) {
      // Initialize with default values
      const packageDefaultValue = packageDefaults[category]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(newSettings as any)[category] =
        packageDefaultValue !== undefined ? packageDefaultValue : DEFAULT_PHOTO_STYLE_SETTINGS[category]
    }
    
    // Update the type based on toggle
    if (newSettings[category]) {
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
            newSettings.expression = { type: 'neutral' }
            break
          case 'lighting':
            newSettings.lighting = { type: 'natural' }
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
    }
    onChange(newSettings)
  }

  const isCategoryPredefined = (category: CategoryType) => {
    // When showToggles is true (admin setting style), always check current value
    // to reflect the admin's active changes, not the original context
    if (showToggles) {
      const categorySettings = value[category]
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
      const originalSettings = originalContextSettings[category]
      if (category === 'clothing') {
        return !!(
          originalSettings && (originalSettings as { style?: string }).style !== 'user-choice'
        )
      }
      return !!(
        originalSettings && (originalSettings as { type?: string }).type !== 'user-choice'
      )
    }

    // Fallback to current value logic
    const categorySettings = value[category]
    if (category === 'clothing') {
      return !!(
        categorySettings && (categorySettings as { style?: string }).style !== 'user-choice'
      )
    }
    return !!(
      categorySettings && (categorySettings as { type?: string }).type !== 'user-choice'
    )
  }

  const getCategoryStatus = (category: CategoryType) => {
    const categorySettings = value[category]
    if (!categorySettings) return 'not-set'
    if (category === 'clothing') {
      if ((categorySettings as { style?: string }).style === 'user-choice') return 'user-choice'
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
        className={`transition ${
          isPredefined
            ? 'rounded-lg border shadow-sm bg-white border-gray-200'
            : isUserChoice
              ? 'rounded-lg border shadow-sm bg-brand-primary-light border-brand-primary/50 hover:ring-1 hover:ring-brand-primary/60'
              : 'rounded-lg border shadow-sm bg-white border-gray-200'
        }`}
      >
        {/* Category Header */}
        <div className={`${
          isPredefined 
            ? 'p-4 border-b border-gray-200' 
            : 'p-5 md:p-4 border-b border-gray-200'
        }`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between overflow-hidden">
            {/* Mobile: Icon, title, and badge on same line */}
            <div className="flex items-center gap-3 min-w-0 flex-1 md:flex-none">
              <Icon className="h-6 w-6 md:h-5 md:w-5 text-gray-600 flex-shrink-0" />
              <div className="min-w-0 flex-1 md:flex-none">
                <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl md:text-lg font-semibold text-gray-900 break-words">
                  {t(`categories.${category.key}.title`, { default: category.label })}
                </h3>
                  {/* Status badge - inline with title on mobile only - hide when showToggles is true (admin setting style) */}
                  {!showToggles && (
                    <span className={`md:hidden inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium flex-shrink-0 ${
                      isUserChoice ? 'bg-purple-100 text-purple-800' :
                      isLockedByPreset ? 'bg-red-50 text-red-600 border border-red-200' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {isUserChoice ? (
                        <SparklesIcon className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <LockClosedIcon className={`h-4 w-4 ${isLocked ? 'text-red-600' : ''}`} aria-hidden="true" />
                      )}
                      {chipLabel}
                    </span>
                  )}
                </div>
                <p className={`text-base md:text-sm text-gray-600 mt-1 md:mt-0 ${
                  category.key === 'background' && isPredefined ? 'hidden' : 'hidden md:block'
                }`}>
                  {t(`categories.${category.key}.description`, { default: category.description })}
                </p>
              </div>
            </div>
            {/* Desktop: Badge and toggle on the right */}
            <div className="hidden md:flex items-center gap-3 flex-shrink-0 max-w-full">
              {/* Status badges - hide when showToggles is true (admin setting style) */}
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

              {/* Toggle switch - show when showToggles is true (admin setting style) */}
              {showToggles && (
                <button
                  id={`${category.key}-toggle`}
                  type="button"
                  onClick={(e) => handleCategoryToggle(category.key, !isPredefined, e)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-1 flex-shrink-0"
                >
                  <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
                    isPredefined ? 'bg-brand-primary' : 'bg-gray-300'
                  }`}>
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                      isPredefined ? 'translate-x-5' : 'translate-x-1'
                    }`} />
                  </div>
                  <span className={isPredefined ? 'text-brand-primary' : 'text-gray-600'}>{isPredefined
                      ? t('toggle.predefined', { default: 'Predefined' })
                      : t('toggle.userChoice', { default: 'User Choice' })
                    }</span>
                </button>
              )}
            </div>
            {/* Mobile: Toggle below title/badge */}
            {showToggles && (
              <div className="md:hidden w-full">
                <button
                  id={`${category.key}-toggle`}
                  type="button"
                  onClick={(e) => handleCategoryToggle(category.key, !isPredefined, e)}
                  className="flex items-center gap-2 px-4 py-2 text-base font-medium rounded-md transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-1 w-full"
                >
                  <div className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors flex-shrink-0 ${
                    isPredefined ? 'bg-brand-primary' : 'bg-gray-300'
                  }`}>
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      isPredefined ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </div>
                  <span className={isPredefined ? 'text-brand-primary' : 'text-gray-600'}>
                    {isPredefined
                      ? t('toggle.predefined', { default: 'Predefined' })
                      : t('toggle.userChoice', { default: 'User Choice' })
                    }
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Category Settings - always expanded */}
        <div className={`${
          isPredefined 
            ? 'p-0 md:p-4' 
            : 'p-5 md:p-4'
        } ${isLockedByPreset ? 'opacity-60' : ''}`}>
          {category.key === 'background' && (
            <EnhancedBackgroundSelector
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
            <ClothingStyleSelector
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
            />
          )}
          
          {/* Placeholder for other categories */}
          {!['background', 'clothing', 'clothingColors', 'shotType', 'branding', 'expression'].includes(category.key) && (
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

  const visiblePhotoCategories = PHOTO_STYLE_CATEGORIES.filter(c => pkg.visibleCategories.includes(c.key))
  const visibleUserCategories = USER_STYLE_CATEGORIES.filter(c => pkg.visibleCategories.includes(c.key))
  const allCategories = [...visiblePhotoCategories, ...visibleUserCategories]

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
          const categorySettings = initialSettings?.[cat.key]
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
  const editableCategories = allCategories.filter(cat => {
    return wasInitiallyEditable.has(cat.key)
  })
  
  const predefinedCategories = allCategories.filter(cat => {
    return !wasInitiallyEditable.has(cat.key)
  })

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Mobile: Editable sections first, then predefined */}
      <div className="md:hidden space-y-4">
        {editableCategories.length > 0 && (
          <CardGrid>
            {editableCategories.map(renderCategoryCard)}
          </CardGrid>
        )}
        {predefinedCategories.length > 0 && (
          <CardGrid>
            {predefinedCategories.map(renderCategoryCard)}
          </CardGrid>
        )}
      </div>

      {/* Desktop: Original order - Photo Style Section */}
      <div className="hidden md:block space-y-4">
        <div id="composition-settings-section" className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {t('sections.composition', { default: 'Composition settings' })}
              </h3>
              <p className="text-sm text-gray-600">
                {t('sections.compositionDesc', { default: 'Background, branding, and shot type' })}
              </p>
            </div>
            {/* Hide legend when showToggles is true (admin setting style) */}
            {!showToggles && (
              <div className="text-sm text-right">
                <div className="flex items-center justify-end gap-2 text-brand-primary">
                  <SparklesIcon className="h-4 w-4 text-brand-primary" aria-hidden="true" />
                  <span className="text-brand-primary">{t('legend.editable', { default: 'Editable sections highlight what you can customize.' })}</span>
                </div>
                <div className="flex items-center justify-end gap-2 mt-1">
                  <LockClosedIcon className="h-4 w-4 text-red-600" aria-hidden="true" />
                  <span className="text-red-600">
                    {t('legend.locked', { default: 'Pre-set by your team admin.' })}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
        <CardGrid>
          {visiblePhotoCategories.map(renderCategoryCard)}
        </CardGrid>
      </div>

      {/* Desktop: User Style Section */}
      <div className="hidden md:block space-y-4">
        <div id="user-style-settings-section" className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {t('sections.userStyle', { default: 'User Style Settings' })}
          </h3>
          <p className="text-sm text-gray-600">
            {t('sections.userStyleDesc', { default: 'Clothing, expression, and lighting preferences' })}
          </p>
        </div>
        <CardGrid>
          {visibleUserCategories.map(renderCategoryCard)}
        </CardGrid>
      </div>
    </div>
  )
}
