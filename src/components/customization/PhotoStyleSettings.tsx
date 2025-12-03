'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { 
  CameraIcon,
  SparklesIcon,
  LockClosedIcon,
  UserIcon
} from '@heroicons/react/24/outline'
import { SwipeableContainer, FlowNavigation } from '@/components/generation/navigation'
import { FlowHeader } from '@/components/generation/layout'
import { useSwipeEnabled } from '@/hooks/useSwipeEnabled'
import SelfieTipsContent from '@/components/generation/SelfieTipsContent'
import CustomizationIntroContent from '@/components/generation/CustomizationIntroContent'
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
import { CustomizationStepsMeta } from '@/lib/customizationSteps'
import { useCustomizationWizard, MobileStep, MobileCustomStep } from '@/hooks/useCustomizationWizard'
import { 
  PHOTO_STYLE_CATEGORIES, 
  USER_STYLE_CATEGORIES, 
  CategoryConfig 
} from '@/components/customization/categories'
import { ensureVisibleCategories } from '@/domain/style/utils'

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
  onCanGenerateChange?: (canGenerate: boolean) => void
}

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
  onCanGenerateChange
}: PhotoStyleSettingsProps) {
  const t = useTranslations('customization.photoStyle')
  const isSwipeEnabled = useSwipeEnabled()
  const pkg = getPackageConfig(packageId)
  const packageDefaults = React.useMemo(
    () => pkg.defaultSettings || DEFAULT_PHOTO_STYLE_SETTINGS,
    [pkg]
  )

  const { visiblePhotoCategories, visibleUserCategories, allCategories } = React.useMemo(() => {
    // Use package-defined groupings, with defaults for backward compatibility
    const compositionCategoryKeys = pkg.compositionCategories ?? ['background', 'branding', 'pose']
    const userStyleCategoryKeys = pkg.userStyleCategories ?? ['clothing', 'clothingColors', 'expression', 'lighting']
    
    // Ensure visible categories exist
    const visibleCategories = ensureVisibleCategories(pkg)

    // Filter categories based on package's visibleCategories and groupings
    const visiblePhoto = PHOTO_STYLE_CATEGORIES.filter(c => 
      visibleCategories.includes(c.key) && compositionCategoryKeys.includes(c.key)
    )
    const visibleUser = USER_STYLE_CATEGORIES.filter(c => 
      visibleCategories.includes(c.key) && userStyleCategoryKeys.includes(c.key)
    )
    const all = [...visiblePhoto, ...visibleUser]
    return { visiblePhotoCategories: visiblePhoto, visibleUserCategories: visibleUser, allCategories: all }
  }, [pkg])

  // Mobile Wizard Hook
  const {
    mobileSteps,
    activeMobileStep,
    stepIndicatorProps,
    nextStep,
    prevStep,
    directStep,
    isCategoryPredefined,
    currentEditableCategories,
    currentLockedCategories,
    canGenerate
  } = useCustomizationWizard({
    packageId,
    initialSettings: value,
    originalSettings: originalContextSettings,
    mobileExtraSteps,
    onStepMetaChange,
    onStepChange: onMobileStepChange,
    onSwipeBack
  })

  React.useEffect(() => {
    onCanGenerateChange?.(canGenerate)
  }, [canGenerate, onCanGenerateChange])

  // State for tracking customization progress (for locked sections reveal) - Desktop only logic now?
  // Actually, we removed lockedSectionsVisible logic from mobile, but desktop might still use it?
  // The plan said "Remove lockedSectionsVisible check and related code."
  // So I'll remove it entirely. Locked sections are always visible if present.
  
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

  const currentMobileStep = mobileSteps[activeMobileStep]

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Context B: Show editable sections, then teaser or revealed locked sections */}
      {!showToggles && (
        <>
          {/* Mobile swipe experience */}
          <div className="md:hidden space-y-6">
            {mobileSteps.length > 0 ? (
              <div className="space-y-4">
                {/* Fixed header with step indicator - positioned at top of viewport */}
                <div className="fixed top-0 left-0 right-0 z-50 bg-white" style={{ top: 'calc(env(safe-area-inset-top, 0px))' }}>
                  <FlowHeader
                    title={
                      currentMobileStep
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
                    step={stepIndicatorProps}
                    sticky={false}
                  />
                </div>
                {/* Spacer for fixed header */}
                <div className="h-16" />

                {/* Swipeable carousel */}
                <SwipeableContainer
                  onSwipeLeft={nextStep}
                  onSwipeRight={prevStep}
                  enabled={isSwipeEnabled}
                  className="overflow-hidden"
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
                        </div>
                      )
                    })}
                  </div>
                </SwipeableContainer>

                {/* Navigation controls */}
                <FlowNavigation
                  variant="both"
                  current={
                    stepIndicatorProps?.currentAllStepsIndex !== undefined
                      ? stepIndicatorProps.currentAllStepsIndex
                      : activeMobileStep
                  }
                  total={
                    stepIndicatorProps?.totalWithLocked ?? stepIndicatorProps?.total ?? mobileSteps.length
                  }
                  onPrev={prevStep}
                  onNext={nextStep}
                  canGoPrev={true}
                  canGoNext={activeMobileStep < mobileSteps.length - 1}
                  onDotClick={(index) => {
                    directStep(index)
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
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 p-6 text-center">
                <p className="text-sm text-gray-600">
                  {t('sections.customizableDesc', { default: 'Personalize these settings to match your preferences' })}
                </p>
              </div>
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
