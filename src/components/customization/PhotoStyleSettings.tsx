'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import {
  LockClosedIcon,
  SparklesIcon,
  CameraIcon,
  UserIcon
} from '@heroicons/react/24/outline'
import { SwipeableContainer, FlowNavigation } from '@/components/generation/navigation'
import { ScrollAwareHeader } from '@/components/generation/layout'
import { useSwipeEnabled } from '@/hooks/useSwipeEnabled'
import { useGenerationFlowState } from '@/hooks/useGenerationFlowState'
import { useMobileViewport } from '@/hooks/useMobileViewport'
import SelfieTipsContent from '@/components/generation/SelfieTipsContent'
import CustomizationIntroContent from '@/components/generation/CustomizationIntroContent'
import {
  PhotoStyleSettings as PhotoStyleSettingsType,
  CategoryType,
  DEFAULT_PHOTO_STYLE_SETTINGS,
  ClothingColorSettings,
  ShotTypeSettings,
  PoseSettings,
  BackgroundSettings
} from '@/types/photo-style'
import { userChoice, predefined, hasValue, isUserChoice } from '@/domain/style/elements/base/element-types'
import BackgroundSelector from '@/domain/style/elements/background/BackgroundSelector'
import ClothingSelector from '@/domain/style/elements/clothing/ClothingSelector'
import ClothingColorSelector from '@/domain/style/elements/clothing-colors/ClothingColorSelector'
import { CustomClothingSelector } from '@/domain/style/elements/custom-clothing/CustomClothingSelector'
import ShotTypeSelector from '@/domain/style/elements/shot-type/ShotTypeSelector'
import BrandingSelector from '@/domain/style/elements/branding/BrandingSelector'
import ExpressionSelector from '@/domain/style/elements/expression/ExpressionSelector'
import PoseSelector from '@/domain/style/elements/pose/PoseSelector'
import { getPackageConfig } from '@/domain/style/packages'
import { defaultAspectRatioForShot } from '@/domain/style/elements/aspect-ratio/config'
import { resolveShotType } from '@/domain/style/elements/shot-type/config'
import type { KnownClothingStyle } from '@/domain/style/elements/clothing/config'
import { getWardrobeExclusions } from '@/domain/style/elements/clothing/prompt'
import type { ClothingColorKey } from '@/domain/style/elements/clothing-colors/types'
import { CardGrid, Tooltip } from '@/components/ui'
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline'
import { buildCustomizationStepIndicatorWithSelfie, CustomizationStepsMeta } from '@/lib/customizationSteps'
import { useCustomizationWizard } from '@/hooks/useCustomizationWizard'
// Import element registry
import { getElements } from '@/domain/style/elements'
import type { ElementMetadata as CategoryConfig } from '@/domain/style/elements'
import { getElementConfig, type CategoryType as RegistryCategoryType } from '@/domain/style/elements/registry'
import '@/domain/style/elements/init-registry' // Initialize element registry

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
  onSwipeBack?: () => void // Called when user swipes back from the first step (mobile only)
  onStepMetaChange?: (meta: CustomizationStepsMeta) => void
  /** Optional header to show above the flow header on mobile (e.g., app header with hamburger menu) */
  topHeader?: React.ReactNode
  /** Category key to highlight with pulsing border (desktop only) */
  highlightedField?: string | null
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

// Categories are now loaded dynamically from element metadata registry
// No hardcoded lists needed!

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
  onMobileStepChange,
  onSwipeBack,
  onStepMetaChange,
  topHeader,
  highlightedField
}: PhotoStyleSettingsProps) {
  const t = useTranslations('customization.photoStyle')
  const isSwipeEnabled = useSwipeEnabled()
  const isMobileViewport = useMobileViewport()
  const pkg = getPackageConfig(packageId)
  const packageDefaults = React.useMemo(
    () => pkg.defaultSettings || DEFAULT_PHOTO_STYLE_SETTINGS,
    [pkg]
  )

  const { visiblePhotoCategories, visibleUserCategories, allCategories } = React.useMemo(() => {
    // Get all elements for this package's visible categories
    const allElements = getElements(pkg.visibleCategories)

    // Use package-defined groupings, with defaults for backward compatibility
    const compositionCategoryKeys = pkg.compositionCategories ?? ['background', 'branding', 'pose', 'shotType']
    const userStyleCategoryKeys = pkg.userStyleCategories ?? ['clothing', 'clothingColors', 'expression', 'lighting']

    // Split by group
    const visiblePhoto = allElements.filter(e =>
      (e.group === 'composition' || compositionCategoryKeys.includes(e.key)) &&
      compositionCategoryKeys.includes(e.key)
    )
    const visibleUser = allElements.filter(e =>
      (e.group === 'userStyle' || userStyleCategoryKeys.includes(e.key)) &&
      userStyleCategoryKeys.includes(e.key)
    )

    return {
      visiblePhotoCategories: visiblePhoto,
      visibleUserCategories: visibleUser,
      allCategories: allElements
    }
  }, [pkg])

  // State for tracking customization progress (for locked sections reveal)
  const [hasCustomizedEditable, setHasCustomizedEditable] = React.useState(false)
  const [activeMobileStep, setActiveMobileStep] = React.useState(0)

  // Get persisted visited steps from flow state
  const { visitedSteps: persistedVisitedSteps, setVisitedSteps: setPersistentVisitedSteps } = useGenerationFlowState()

  // Track which editable steps have been visited (by their index in allNumberedSteps)
  // Initialize from persisted state
  const [visitedEditableSteps, setVisitedEditableSteps] = React.useState<Set<number>>(() => new Set(persistedVisitedSteps))

  // Compute resolved clothing colors (no memoization to ensure fresh values)
  const defaults = packageDefaults.clothingColors
  const current = value.clothingColors
  const defaultColors = defaults && hasValue(defaults) ? defaults.value : {}

  let resolvedClothingColors: ClothingColorSettings

  if (current) {
    const currentColors = hasValue(current) ? current.value : {}
    if (isUserChoice(current)) {
      resolvedClothingColors = userChoice({
        ...defaultColors,
        ...currentColors
      })
    } else {
      resolvedClothingColors = predefined({
        ...defaultColors,
        ...currentColors
      })
    }
  } else if (defaultColors && Object.keys(defaultColors).length > 0) {
    resolvedClothingColors = userChoice({ ...defaultColors })
  } else {
    resolvedClothingColors = userChoice()
  }

  // Compute which clothing color pickers to hide based on shot type and clothing style
  const excludedClothingColors = React.useMemo<ClothingColorKey[]>(() => {
    const exclusions = new Set<ClothingColorKey>()

    // Get exclusions from shot type (check value first, then package defaults)
    const shotTypeValue = hasValue(value.shotType)
      ? value.shotType.value.type
      : hasValue(packageDefaults.shotType)
        ? packageDefaults.shotType.value.type
        : undefined
    if (shotTypeValue) {
      const shotTypeConfig = resolveShotType(shotTypeValue)
      if (shotTypeConfig.excludeClothingColors) {
        shotTypeConfig.excludeClothingColors.forEach(c => exclusions.add(c))
      }
    }

    // Get exclusions from clothing style + detail (check value first, then package defaults)
    const clothingStyle = value.clothing?.value?.style || packageDefaults.clothing?.value?.style
    if (clothingStyle) {
      const knownStyle = clothingStyle as KnownClothingStyle
      const clothingDetail = value.clothing?.value?.details || packageDefaults.clothing?.value?.details
      const wardrobeExclusions = getWardrobeExclusions(knownStyle, clothingDetail)
      wardrobeExclusions.forEach(c => exclusions.add(c))
    }

    return Array.from(exclusions)
  }, [value.shotType, value.clothing?.value?.style, value.clothing?.value?.details, packageDefaults])

  // Track last synced outfit colors to avoid infinite loops
  const lastSyncedOutfitColorsRef = React.useRef<string | null>(null)

  // Auto-sync outfit colors to clothing colors when outfit analysis completes
  React.useEffect(() => {
    // Only sync if we have detected colors from outfit analysis
    const outfitColors = value.customClothing?.colors
    if (!outfitColors) return

    // Create a signature of the outfit colors to track if they've changed
    const outfitColorSignature = JSON.stringify(outfitColors)

    // Skip if we've already synced these exact colors
    if (lastSyncedOutfitColorsRef.current === outfitColorSignature) {
      return
    }

    // Map outfit colors to clothing colors:
    // outfit.baseLayer -> clothing.baseLayer (shirt), outfit.topLayer -> clothing.topLayer (jacket), etc.
    const newClothingColors: Record<string, string> = {}
    if (outfitColors.baseLayer) newClothingColors.baseLayer = outfitColors.baseLayer
    if (outfitColors.topLayer) newClothingColors.topLayer = outfitColors.topLayer
    if (outfitColors.bottom) newClothingColors.bottom = outfitColors.bottom
    if (outfitColors.shoes) newClothingColors.shoes = outfitColors.shoes

    // Only update if we have at least one color
    if (Object.keys(newClothingColors).length > 0) {
      // Mark these colors as synced
      lastSyncedOutfitColorsRef.current = outfitColorSignature

      const newSettings = { ...value }
      // Preserve the existing mode (predefined/user-choice), only default to user-choice if not set
      const existingMode = newSettings.clothingColors?.mode || 'user-choice'
      newSettings.clothingColors = existingMode === 'predefined'
        ? predefined(newClothingColors)
        : userChoice(newClothingColors)
      onChange(newSettings)
    }
  }, [value.customClothing?.colors, value, onChange]) // Re-run when outfit colors change

  // Auto-reveal locked sections after user customizes editable sections (Context B only)
  React.useEffect(() => {
    if (showToggles || hasCustomizedEditable) return // Skip for admin context or already revealed

    const editable = allCategories.filter(cat => {
      const categorySettings = (value as Record<string, unknown>)[cat.key]
      if (!categorySettings) return true
      // Use the helper function which handles both new and legacy formats
      return isUserChoiceSetting(cat.key, categorySettings)
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
      if (!shotTypeSettings || isUserChoice(shotTypeSettings) || !hasValue(shotTypeSettings)) {
        return
      }

      const aspectRatioConfig = defaultAspectRatioForShot(shotTypeSettings.value.type)
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

    // Check if category has an element config (some categories like 'aspectRatio' don't)
    // Valid registry categories that have ElementConfig implementations
    const registryCategories: readonly string[] = [
      'background',
      'branding',
      'clothing',
      'clothingColors',
      'customClothing',
      'shotType',
      'style',
      'expression',
      'lighting',
      'pose'
    ] as const

    // Skip categories that don't have element configs (like aspectRatio)
    if (!registryCategories.includes(category)) {
      console.warn(`Category ${category} does not support toggling via element config`)
      return
    }

    // Get element config from registry (category is now narrowed to RegistryCategoryType)
    const elementConfig = getElementConfig(category as RegistryCategoryType)

    if (!elementConfig) {
      console.warn(`No element config found for category: ${category}`)
      return
    }

    // Initialize if not set
    if (!(newSettings as Record<string, unknown>)[category]) {
      const packageDefaultValue = (packageDefaults as Record<string, unknown>)[category]
      const defaultValue = (DEFAULT_PHOTO_STYLE_SETTINGS as Record<string, unknown>)[category]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(newSettings as any)[category] =
        packageDefaultValue !== undefined ? packageDefaultValue : defaultValue
    }

    // Get the new value from the element config
    const packageDefault = (packageDefaults as Record<string, unknown>)[category]
    const newValue = isPredefined
      ? elementConfig.getDefaultPredefined(packageDefault)
      : elementConfig.getDefaultUserChoice()

    // Special handling for clothingColors to preserve existing colors
    if (category === 'clothingColors' && hasValue(newSettings.clothingColors)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (newValue as any).value = newSettings.clothingColors.value
    }

    // Update the setting
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(newSettings as any)[category] = newValue

    // Special post-processing for certain categories
    if (category === 'shotType') {
      syncAspectRatioWithShotType(newSettings, newSettings.shotType)
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

  const isUserChoiceSetting = (category: CategoryType, settings: unknown) => {
    if (!settings) return false

    // CustomClothing uses a different pattern (type field directly, not wrapped)
    if (category === 'customClothing') {
      return (settings as { type?: string }).type === 'user-choice'
    }

    // All other categories use the ElementSetting wrapper pattern
    // Check for new format first (mode property)
    const wrapped = settings as { mode?: string; type?: string; style?: string }
    if ('mode' in wrapped && wrapped.mode !== undefined) {
      return wrapped.mode === 'user-choice'
    }

    // Legacy format fallback
    if (category === 'clothing') {
      return wrapped.style === 'user-choice'
    }
    return wrapped.type === 'user-choice'
  }

  const isPredefinedSetting = (category: CategoryType, settings: unknown) => {
    if (!settings) return false

    // CustomClothing uses a different pattern (type field directly, not wrapped)
    if (category === 'customClothing') {
      return (settings as { type?: string }).type === 'predefined'
    }

    // All other categories use the ElementSetting wrapper pattern
    // Check for new format first (mode property)
    const wrapped = settings as { mode?: string; type?: string; style?: string }
    if ('mode' in wrapped && wrapped.mode !== undefined) {
      return wrapped.mode === 'predefined'
    }

    // Legacy format fallback
    if (category === 'clothing') {
      return wrapped.style !== 'user-choice'
    }
    return wrapped.type !== 'user-choice'
  }

  const isCategoryPredefined = (category: CategoryType) => {
    const categorySettings = (value as Record<string, unknown>)[category]

    // If the current value is explicitly user-choice, treat it as not predefined
    if (isUserChoiceSetting(category, categorySettings)) {
      return false
    }

    // Admin mode should always reflect the current value
    if (showToggles) {
      return isPredefinedSetting(category, categorySettings)
    }

    // When users can override predefined values, rely on their current selection
    if (!readonlyPredefined) {
      return isPredefinedSetting(category, categorySettings)
    }

    // If predefined fields are readonly, use the original context to know which were locked
    if (originalContextSettings) {
      const originalSettings = (originalContextSettings as Record<string, unknown>)[category]
      return isPredefinedSetting(category, originalSettings)
    }

    return isPredefinedSetting(category, categorySettings)
  }

  const getCategoryStatus = (category: CategoryType) => {
    const categorySettings = (value as Record<string, unknown>)[category]
    if (!categorySettings) return 'not-set'
    return isUserChoiceSetting(category, categorySettings) ? 'user-choice' : 'predefined'
  }


  const renderCategoryCard = (category: CategoryConfig) => {
    const Icon = category.icon
    const status = getCategoryStatus(category.key)
    const isPredefined = isCategoryPredefined(category.key)
    const isUserChoice = status === 'user-choice'
    // When showToggles is true (admin setting style), nothing is locked
    const isLockedByPreset = !showToggles && readonlyPredefined && isPredefined
    const isLocked = isLockedByPreset
    const isHighlighted = highlightedField === category.key
    const chipLabel = isUserChoice
      ? t('legend.editableChip', { default: 'Editable' })
      : isLockedByPreset
        ? t('legend.lockedChip', { default: 'Locked' })
        : t('legend.presetChip', { default: 'Preset active' })

    return (
      <div
        key={category.key}
        id={`${category.key}-settings`}
        className={`w-full max-w-full overflow-hidden transition-all duration-300 ease-out ${
          isPredefined
            ? 'rounded-xl border shadow-md bg-white border-gray-200 hover:shadow-lg hover:border-gray-300 hover:-translate-y-0.5'
            : isUserChoice
              ? 'rounded-xl border-2 shadow-lg bg-gradient-to-br from-brand-primary-light/50 to-brand-primary-light/30 border-brand-primary/60 hover:shadow-xl hover:border-brand-primary/80 hover:scale-[1.01] hover:-translate-y-0.5'
              : 'rounded-xl border shadow-md bg-white border-gray-200 hover:shadow-lg hover:border-gray-300 hover:-translate-y-0.5'
        } ${isLockedByPreset ? 'opacity-75' : ''}`}
        style={isHighlighted ? { outline: '3px solid rgba(99, 102, 241, 0.5)', outlineOffset: '2px' } : undefined}
      >
        {/* Category Header */}
        <div
          className={`${
            isPredefined
              ? 'p-3 md:p-4 border-b border-gray-200/80'
              : 'p-3 md:p-4 border-b border-gray-200/80'
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
            ? 'p-3 md:p-5'
            : 'p-3 md:p-5'
        }`}>
          {category.key === 'background' && (
            <BackgroundSelector
              value={value.background || userChoice()}
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
              value={value.clothing || userChoice()}
              onChange={(settings) => handleCategorySettingsChange('clothing', settings)}
              clothingColors={resolvedClothingColors}
              excludeColors={excludedClothingColors}
              availableStyles={pkg.availableClothingStyles}
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
              showHeader={false}
              excludeColors={excludedClothingColors}
              customClothingColors={value.customClothing?.colors}
            />
          )}

          {category.key === 'customClothing' && (
            <CustomClothingSelector
              value={value.customClothing || { type: 'predefined' }}
              onChange={(settings) => handleCategorySettingsChange('customClothing', settings)}
              disabled={!showToggles && readonlyPredefined && isPredefined}
              mode={showToggles ? 'admin' : 'user'}
              token={token}
            />
          )}

          {category.key === 'shotType' && (
            <ShotTypeSelector
              value={value.shotType || userChoice()}
              onChange={(settings) => handleCategorySettingsChange('shotType', settings)}
              isPredefined={!showToggles && readonlyPredefined && isPredefined}
              isDisabled={!showToggles && readonlyPredefined && isPredefined}
            />
          )}
          
          {category.key === 'branding' && (
            <BrandingSelector
              value={value.branding || userChoice()}
              onChange={(settings) => handleCategorySettingsChange('branding', settings)}
              isPredefined={!showToggles && readonlyPredefined && isPredefined}
              isDisabled={!showToggles && readonlyPredefined && isPredefined}
              token={token}
            />
          )}
          
          {category.key === 'expression' && (
            <ExpressionSelector
              value={value.expression || userChoice()}
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
          {!['background', 'clothing', 'clothingColors', 'customClothing', 'shotType', 'branding', 'expression', 'pose'].includes(category.key) && (
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

  // Use shared components for intro steps (mobile swipe variant)

  // Capture initial value on mount to preserve ordering
  const initialValueRef = React.useRef<PhotoStyleSettingsType | undefined>(undefined)
  if (initialValueRef.current === undefined) {
    initialValueRef.current = value
  }

  // Determine initial editable state based on originalContextSettings or initial value
  // This preserves the ordering even when users make changes
  // Use the centralized hook for wizard logic
  const { 
    mobileSteps, 
    currentEditableCategories, 
    currentLockedCategories, 
    customizationStepMeta 
  } = useCustomizationWizard({
    value,
    originalContextSettings: originalContextSettings || initialValueRef.current, // Fallback to initial value if no context
    packageId: packageId || 'headshot1', // Ensure string
    showToggles,
    readonlyPredefined,
    mobileExtraSteps,
    allCategories
  })
  
  const lockedSectionsVisible = true

  const totalMobileSteps = mobileSteps.length
  const currentMobileStep = mobileSteps[activeMobileStep]
  
  // All steps that count toward dots (exclude intro-type steps)
  const allNumberedSteps = React.useMemo(() => {
    return mobileSteps.filter(step => step.type !== 'intro' && step.type !== 'selfie-tips')
  }, [mobileSteps])
  
  // Only editable steps count toward "Step X of Y"
  const editableNumberedSteps = React.useMemo(() => {
    return allNumberedSteps.filter(step => step.type === 'editable')
  }, [allNumberedSteps])
  
  const totalEditableSteps = editableNumberedSteps.length

  // customizationStepMeta is now provided by the hook, but we need to pass it to the effect
  React.useEffect(() => {
    onStepMetaChange?.(customizationStepMeta)
  }, [onStepMetaChange, customizationStepMeta])

  // Get the current step's position in all numbered steps (0-indexed, for dot highlighting)
  const currentAllStepsIndex = React.useMemo(() => {
    if (!currentMobileStep || currentMobileStep.type === 'intro' || currentMobileStep.type === 'selfie-tips') {
      return -1 // Not a numbered step
    }
    
    return allNumberedSteps.findIndex(step => {
      if (step.type === 'custom' && currentMobileStep.type === 'custom') {
        return step.custom?.id === currentMobileStep.custom?.id
      }
      if (step.category && currentMobileStep.category) {
        return step.category.key === currentMobileStep.category.key
      }
      return false
    })
  }, [currentMobileStep, allNumberedSteps])

  // Track visited "clothingColors" step - only this step becomes "done" on visit
  // Other steps become "done" when the user actually makes a selection
  React.useEffect(() => {
    if (currentAllStepsIndex >= 0 && 
        currentMobileStep?.type === 'editable' && 
        currentMobileStep?.category?.key === 'clothingColors') {
      setVisitedEditableSteps(prev => {
        if (prev.has(currentAllStepsIndex)) return prev
        const next = new Set(prev)
        next.add(currentAllStepsIndex)
        return next
      })
    }
  }, [currentAllStepsIndex, currentMobileStep?.type, currentMobileStep?.category?.key])

  // Track which editable steps have been customized (value differs from default)
  // For steps other than clothingColors, this determines the "done" (green) state
  const customizedEditableStepIndices = React.useMemo(() => {
    const customized = new Set<number>()
    editableNumberedSteps.forEach((step) => {
      // Skip clothingColors - it uses visited logic instead
      if (step.category?.key === 'clothingColors') return
      
      let isCustomized = false
      
      if (step.type === 'custom') {
        // Custom steps are considered "set" if they exist
        isCustomized = true
      } else if (step.category) {
        const categorySettings = (value as Record<string, unknown>)[step.category.key]
        const defaultSetting = (packageDefaults as Record<string, unknown>)[step.category.key]
        
        // Compare against originalContextSettings if available (more accurate for team contexts)
        const comparisonSetting = originalContextSettings 
          ? (originalContextSettings as Record<string, unknown>)[step.category.key]
          : defaultSetting
        
        if (categorySettings && comparisonSetting) {
          isCustomized = JSON.stringify(categorySettings) !== JSON.stringify(comparisonSetting)
        } else if (categorySettings && !comparisonSetting) {
          // Has a setting but no comparison - check type
          const settingType = (categorySettings as { type?: string; style?: string }).type || 
                             (categorySettings as { type?: string; style?: string }).style
          isCustomized = settingType !== 'user-choice' && settingType !== undefined
        }
      }
      
      if (isCustomized) {
        const allStepsIdx = allNumberedSteps.findIndex(s => {
          if (step.type === 'custom' && s.type === 'custom') {
            return step.custom?.id === s.custom?.id
          }
          if (step.category && s.category) {
            return step.category.key === s.category.key
          }
          return false
        })
        if (allStepsIdx >= 0) {
          customized.add(allStepsIdx)
        }
      }
    })
    return customized
  }, [editableNumberedSteps, allNumberedSteps, value, packageDefaults, originalContextSettings])

  // Combine visited (for clothingColors) and customized (for other steps) to get all "done" steps
  const doneEditableStepIndices = React.useMemo(() => {
    const done = new Set<number>()
    visitedEditableSteps.forEach(idx => done.add(idx))
    customizedEditableStepIndices.forEach(idx => done.add(idx))
    return done
  }, [visitedEditableSteps, customizedEditableStepIndices])

  // Persist done steps to session storage whenever they change
  // This ensures the dots in FlowProgressDock are updated correctly
  React.useEffect(() => {
    setPersistentVisitedSteps(Array.from(doneEditableStepIndices))
  }, [doneEditableStepIndices, setPersistentVisitedSteps])

  // Get the current step's position in editable steps (1-indexed), or 0 if not a numbered step
  // When on a locked step, show the last editable step number we completed
  const currentNumberedStepIndex = React.useMemo(() => {
    if (currentAllStepsIndex < 0) return 0
    
    // If we're on a locked step, find the last editable step before this position
    // This shows the progress through editable steps even when viewing locked steps
    if (currentMobileStep?.type === 'locked') {
      // Find the last editable step before this position
      let lastEditableIndex = -1
      for (let i = currentAllStepsIndex - 1; i >= 0; i--) {
        const numberedStep = allNumberedSteps[i]
        if (!numberedStep) continue
        if (numberedStep.type === 'editable') {
          const editableIndex = editableNumberedSteps.findIndex(step => {
            if (step.type === 'custom' && numberedStep.type === 'custom') {
              return step.custom?.id === numberedStep.custom?.id
            }
            if (step.category && numberedStep.category) {
              return step.category.key === numberedStep.category.key
            }
            return false
          })
          if (editableIndex >= 0) {
            lastEditableIndex = editableIndex
            break
          }
        }
      }
      // If no editable step found before, show 0 (means we haven't completed any editable steps yet)
      return lastEditableIndex >= 0 ? lastEditableIndex + 1 : 0
    }
    
    // For editable steps, find position in editable steps list
    const editableIndex = editableNumberedSteps.findIndex(step => {
      if (step.type === 'custom' && currentMobileStep?.type === 'custom') {
        return step.custom?.id === currentMobileStep.custom?.id
      }
      if (step.category && currentMobileStep?.category) {
        return step.category.key === currentMobileStep.category.key
      }
      return false
    })
    return editableIndex >= 0 ? editableIndex + 1 : 0
  }, [currentMobileStep, editableNumberedSteps, allNumberedSteps, currentAllStepsIndex])
  
  // Show step indicator on all numbered steps (editable and locked)
  const isNumberedStep = currentMobileStep && 
    currentMobileStep.type !== 'intro' && 
    currentMobileStep.type !== 'selfie-tips' &&
    allNumberedSteps.some(step => {
      if (step.type === 'custom' && currentMobileStep.type === 'custom') {
        return step.custom?.id === currentMobileStep.custom?.id
      }
      if (step.category && currentMobileStep.category) {
        return step.category.key === currentMobileStep.category.key
      }
      return false
    })
  
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

  const stepIndicatorProps = React.useMemo(() => {
    if (!isNumberedStep || totalEditableSteps === 0) {
      return undefined
    }
    const currentEditableIndex = (currentNumberedStepIndex > 0 ? currentNumberedStepIndex : 1) - 1
    return buildCustomizationStepIndicatorWithSelfie(customizationStepMeta, {
      currentEditableIndex,
      currentAllStepsIndex: currentAllStepsIndex >= 0 ? currentAllStepsIndex : undefined,
      visitedEditableSteps: Array.from(doneEditableStepIndices)
    })
  }, [
    isNumberedStep,
    totalEditableSteps,
    currentNumberedStepIndex,
    customizationStepMeta,
    currentAllStepsIndex,
    doneEditableStepIndices
  ])

  // Map step indicator index (0=selfie, 1+=customization) to mobileSteps index
  const mapStepIndicatorIndexToMobileStep = React.useCallback((indicatorIndex: number): number | null => {
    if (indicatorIndex === 0) {
      // Index 0 is selfie - find it in mobileSteps (could be in mobileExtraSteps)
      const selfieIndex = mobileSteps.findIndex(step => 
        step.type === 'custom' && (
          step.custom?.id === 'selfie-selection' || 
          step.custom?.id === 'selfie'
        )
      )
      return selfieIndex >= 0 ? selfieIndex : null
    }
    // Index 1+ maps to customization steps (indicatorIndex - 1 in allNumberedSteps)
    const numberedStepIndex = indicatorIndex - 1
    if (numberedStepIndex < 0 || numberedStepIndex >= allNumberedSteps.length) {
      return null
    }
    const targetStep = allNumberedSteps[numberedStepIndex]
    // Find this step in mobileSteps
    const mobileIndex = mobileSteps.findIndex(step => {
      if (targetStep.type === 'custom' && step.type === 'custom') {
        return step.custom?.id === targetStep.custom?.id
      }
      if (targetStep.category && step.category) {
        return step.category.key === targetStep.category.key
      }
      return false
    })
    return mobileIndex >= 0 ? mobileIndex : null
  }, [mobileSteps, allNumberedSteps])

  const handleNextStep = React.useCallback(() => {
    setActiveMobileStep(prev => {
      if (mobileSteps.length === 0) return 0
      return Math.min(prev + 1, mobileSteps.length - 1)
    })
  }, [mobileSteps.length])

  const handlePrevStep = React.useCallback(() => {
    setActiveMobileStep(prev => {
      if (prev === 0 && onSwipeBack) {
        // At first step, trigger swipe back to previous page
        onSwipeBack()
        return prev
      }
      return Math.max(prev - 1, 0)
    })
  }, [onSwipeBack])

  const handleDirectStepChange = React.useCallback((index: number) => {
    setActiveMobileStep(prev => {
      if (index < 0 || index >= mobileSteps.length) {
        return prev
      }
      return index
    })
  }, [mobileSteps.length])

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
          <div className="md:hidden pb-32 w-full max-w-full">
            {mobileSteps.length > 0 ? (
              <div className="w-full max-w-full">
                {/* Scroll-aware header: when topHeader is provided, shows dual headers (app + flow) */}
                {/* When no topHeader, shows only flow header as sticky (not fixed) */}
                <ScrollAwareHeader
                  top={topHeader}
                  flowHeader={{
                    title: currentMobileStep
                      ? currentMobileStep.type === 'locked'
                        ? t('mobile.banner.preset', { default: 'Team preset: {label}', label: currentMobileStep.category ? t(`categories.${currentMobileStep.category.key}.title`, { default: currentMobileStep.category.label }) : '' })
                        : currentMobileStep.type === 'selfie-tips'
                          ? t('mobile.banner.selfieTipsHeading', { default: 'Selfie tips' })
                          : currentMobileStep.type === 'intro'
                          ? t('mobile.banner.introHeading', { default: 'Meet your photo style controls' })
                          : currentMobileStep.type === 'custom' && currentMobileStep.custom
                            ? currentMobileStep.custom.title
                            : t('mobile.banner.customize', { default: 'Customize {label}', label: currentMobileStep.category ? t(`categories.${currentMobileStep.category.key}.title`, { default: currentMobileStep.category.label }) : '' })
                      : t('sections.customizable', { default: 'Customize Your Style' }),
                    step: stepIndicatorProps
                  }}
                  fixedOnMobile={Boolean(topHeader)}
                />
                {/* Spacer for fixed header - only needed when topHeader is provided */}
                {isMobileViewport && topHeader && <div style={{ height: '120px' }} />}

                {/* Swipeable carousel */}
                <SwipeableContainer
                  onSwipeLeft={handleNextStep}
                  onSwipeRight={handlePrevStep}
                  enabled={isSwipeEnabled}
                  className="overflow-hidden w-full max-w-full"
                >
                  <div
                    className="flex items-start transition-transform duration-300 ease-in-out"
                    style={{
                      transform: `translateX(-${activeMobileStep * 100}%)`,
                      width: '100%',
                      maxWidth: '100vw'
                    }}
                  >
                    {mobileSteps.map((step, idx) => {
                      const hasNoBorder = step.type === 'custom' && step.custom?.noBorder
                      const isActiveStep = idx === activeMobileStep
                      return (
                        <div 
                          key={step.category ? step.category.key : step.custom ? step.custom.id : step.type === 'selfie-tips' ? 'selfie-tips' : `intro-${idx}`} 
                          className={`w-full flex-shrink-0 pb-4 px-4 max-w-full transition-opacity duration-300 ${isActiveStep ? 'opacity-100' : 'opacity-0'}`}
                        >
                          <div className={`${hasNoBorder ? '' : 'rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 shadow-sm'} w-full max-w-full overflow-hidden`}>
                            {step.type === 'selfie-tips' && <SelfieTipsContent variant="swipe" />}
                            {step.type === 'intro' && <CustomizationIntroContent variant="swipe" />}
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
                          {/* Navigation controls - positioned directly below each card */}
                          {isActiveStep && (
                            <FlowNavigation
                              className="mt-4"
                              variant="both"
                              current={
                                stepIndicatorProps?.currentAllStepsIndex !== undefined
                                  ? stepIndicatorProps.currentAllStepsIndex
                                  : activeMobileStep
                              }
                              total={
                                stepIndicatorProps?.totalWithLocked ?? stepIndicatorProps?.total ?? totalMobileSteps
                              }
                              onPrev={handlePrevStep}
                              onNext={handleNextStep}
                              canGoPrev={true}
                              canGoNext={activeMobileStep < totalMobileSteps - 1}
                              onDotClick={(index) => {
                                // Map from step indicator index back to mobileSteps index
                                if (stepIndicatorProps) {
                                  const mobileIndex = mapStepIndicatorIndexToMobileStep(index)
                                  if (mobileIndex !== null) {
                                    handleDirectStepChange(mobileIndex)
                                  }
                                } else {
                                  handleDirectStepChange(index)
                                }
                              }}
                              stepColors={
                                stepIndicatorProps
                                  ? {
                                      lockedSteps: stepIndicatorProps.lockedSteps,
                                      visitedEditableSteps: stepIndicatorProps.visitedEditableSteps
                                    }
                                  : undefined
                              }
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </SwipeableContainer>

              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 p-6 text-center">
                <p className="text-sm text-gray-600">
                  {t('sections.customizableDesc', { default: 'Select your choice for each editable part' })}
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
                        {t('sections.customizableDesc', { default: 'Select your choice for each editable part' })}
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
