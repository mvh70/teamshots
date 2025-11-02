'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { 
  PhotoIcon, 
  SwatchIcon, 
  UserIcon, 
  PaintBrushIcon, 
  FaceSmileIcon, 
  LightBulbIcon,
  CameraIcon
} from '@heroicons/react/24/outline'
import { 
  PhotoStyleSettings as PhotoStyleSettingsType, 
  CategoryType,
  DEFAULT_PHOTO_STYLE_SETTINGS 
} from '@/types/photo-style'
import EnhancedBackgroundSelector from './EnhancedBackgroundSelector'
import ClothingStyleSelector from './ClothingStyleSelector'
import ClothingColorSelector from './ClothingColorSelector'
import ShotTypeSelector from './ShotTypeSelector'
import BrandingSelector from './BrandingSelector'
import { getPackageConfig } from '@/domain/style/packages'

interface PhotoStyleSettingsProps {
  value: PhotoStyleSettingsType
  onChange: (settings: PhotoStyleSettingsType) => void
  className?: string
  readonlyPredefined?: boolean // If true, predefined fields are read-only
  originalContextSettings?: PhotoStyleSettingsType // Original context settings to determine what was predefined
  showToggles?: boolean // If false, hide toggles entirely (for direct photo definition)
  packageId?: string // Optional package to control visible categories/overrides
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
    description: 'Choose background style and settings'
  },
  {
    key: 'branding',
    label: 'Branding',
    icon: SwatchIcon,
    description: 'Logo and branding options'
  },
  {
    key: 'style',
    label: 'Photo Style',
    icon: PaintBrushIcon,
    description: 'Overall photo style preset'
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
    key: 'shotType',
    label: 'Shot Type',
    icon: CameraIcon,
    description: 'Photo framing and composition'
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
  packageId
}: PhotoStyleSettingsProps) {
  const t = useTranslations('customization.photoStyle')
  // All categories are always expanded per UX requirement
  const pkg = getPackageConfig(packageId)

  const handleCategoryToggle = (category: CategoryType, isPredefined: boolean, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    
    const newSettings = { ...value }
    
    if (!newSettings[category]) {
      // Initialize with default values
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (newSettings as any)[category] = DEFAULT_PHOTO_STYLE_SETTINGS[category]
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
            newSettings.clothing = { style: 'business' }
            break
          case 'clothingColors':
            newSettings.clothingColors = { colors: { topCover: 'navy', topBase: 'white', bottom: 'gray' } }
            break
          case 'shotType':
            newSettings.shotType = { type: 'headshot' }
            break
          case 'style':
            newSettings.style = { type: 'preset', preset: 'corporate' }
            break
          case 'expression':
            newSettings.expression = { type: 'professional' }
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
            newSettings.clothingColors = undefined
            break
          case 'shotType':
            newSettings.shotType = { type: 'user-choice' }
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
    // Don't allow changes if in readonly mode and the category is predefined
    // Allow changes to user-choice fields even when readonlyPredefined is true
    if (readonlyPredefined && isCategoryPredefined(category)) {
      return
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newSettings: any = { ...value }
    newSettings[category] = settings
    onChange(newSettings)
  }

  const isCategoryPredefined = (category: CategoryType) => {
    // If we have original context settings, check if this category was predefined in the original context
    if (originalContextSettings) {
      const originalSettings = originalContextSettings[category]
      if (category === 'clothing') {
        return originalSettings && (originalSettings as { style?: string }).style !== 'user-choice'
      }
      if (category === 'clothingColors') {
        return originalSettings !== undefined
      }
      return originalSettings && (originalSettings as { type?: string }).type !== 'user-choice'
    }
    
    // Fallback to current value logic
    const categorySettings = value[category]
    if (category === 'clothing') {
      return categorySettings && (categorySettings as { style?: string }).style !== 'user-choice'
    }
    if (category === 'clothingColors') {
      return categorySettings !== undefined
    }
    return categorySettings && (categorySettings as { type?: string }).type !== 'user-choice'
  }

  const getCategoryStatus = (category: CategoryType) => {
    const categorySettings = value[category]
    if (category === 'clothingColors') {
      // clothingColors is undefined for user-choice, defined for predefined
      return categorySettings ? 'predefined' : 'user-choice'
    }
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

    return (
      <div key={category.key} className="bg-white rounded-lg border border-gray-200">
        {/* Category Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon className="h-5 w-5 text-gray-600" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {t(`categories.${category.key}.title`, { default: category.label })}
                </h3>
                <p className="text-sm text-gray-600">
                  {t(`categories.${category.key}.description`, { default: category.description })}
                </p>
              </div>
            </div>
            
            {/* Show status section */}
            <div className="flex items-center gap-3">
              {readonlyPredefined ? (
                // Show simple status badge when in readonly mode
                <div className={`px-3 py-1.5 text-sm font-medium rounded-full ${
                  isPredefined 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-green-100 text-green-800'
                }`}>
                  {isPredefined 
                    ? t('toggle.predefined', { default: 'Predefined' })
                    : t('toggle.userChoice', { default: 'User Choice' })
                  }
                </div>
              ) : showToggles ? (
                  // Show toggle when in edit mode
                  <button
                    type="button"
                    onClick={(e) => handleCategoryToggle(category.key, !isPredefined, e)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors"
                  >
                    <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      isPredefined ? 'bg-brand-primary' : 'bg-gray-300'
                    }`}>
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        isPredefined ? 'translate-x-5' : 'translate-x-1'
                      }`} />
                    </div>
                    <span className={isPredefined ? 'text-brand-primary' : 'text-gray-600'}>
                      {isPredefined 
                        ? t('toggle.predefined', { default: 'Predefined' })
                        : t('toggle.userChoice', { default: 'User Choice' })
                      }
                    </span>
                  </button>
                ) : null}
              </div>
          </div>
        </div>

        {/* Category Settings - always expanded */}
        <div className={`p-4 ${isUserChoice ? 'opacity-60' : ''}`}>
          {category.key === 'background' && (
            <EnhancedBackgroundSelector
              value={value.background || { type: 'user-choice' }}
              onChange={(settings) => handleCategorySettingsChange('background', settings)}
              isDisabled={readonlyPredefined && isPredefined}
              availableBackgrounds={pkg.availableBackgrounds}
            />
          )}
          
          {category.key === 'clothing' && (
            <ClothingStyleSelector
              value={value.clothing || { style: 'user-choice' }}
              onChange={(settings) => handleCategorySettingsChange('clothing', settings)}
              isDisabled={readonlyPredefined && isPredefined}
            />
          )}

          {category.key === 'clothingColors' && (
            <ClothingColorSelector
              value={value.clothingColors || { colors: {} }}
              onChange={(settings) => handleCategorySettingsChange('clothingColors', settings)}
              isDisabled={readonlyPredefined && isPredefined}
            />
          )}

          {category.key === 'shotType' && (
            <ShotTypeSelector
              value={value.shotType || { type: 'user-choice' }}
              onChange={(settings) => handleCategorySettingsChange('shotType', settings)}
              isDisabled={readonlyPredefined && isPredefined}
            />
          )}
          
          {category.key === 'branding' && (
            <BrandingSelector
              value={value.branding || { type: 'user-choice' }}
              onChange={(settings) => handleCategorySettingsChange('branding', settings)}
              isDisabled={readonlyPredefined && isPredefined}
            />
          )}
          
          {/* Placeholder for other categories */}
          {!['background', 'clothing', 'clothingColors', 'shotType', 'branding'].includes(category.key) && (
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

  return (
    <div className={`space-y-6 ${className}`}>

      {/* Photo Style Section */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visiblePhotoCategories.map(renderCategoryCard)}
        </div>
      </div>

      {/* User Style Section */}
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {t('sections.userStyle', { default: 'User Style Settings' })}
          </h3>
          <p className="text-sm text-gray-600">
            {t('sections.userStyleDesc', { default: 'Clothing, expression, and lighting preferences' })}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleUserCategories.map(renderCategoryCard)}
        </div>
      </div>
    </div>
  )
}
