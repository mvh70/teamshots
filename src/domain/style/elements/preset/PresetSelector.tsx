'use client'

import React, { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { predefined, userChoice } from '../base/element-types'

interface PresetSelectorProps {
    value?: { mode?: string; value?: { presetId: string } }
    onChange: (settings: any) => void
    isPredefined?: boolean
    isDisabled?: boolean
    className?: string
    showHeader?: boolean
    availablePresets?: Record<string, any>
}

// Define preset categories and their sub-styles
export const PRESET_CATEGORIES = {
    linkedin: {
        label: 'LinkedIn',
        icon: '📌',
        presets: ['LINKEDIN_NEUTRAL_STUDIO', 'LINKEDIN_MODERN_OFFICE']
    },
    dating: {
        label: 'Dating',
        icon: '💕',
        presets: ['DATING_LIFESTYLE_CAFE', 'DATING_OUTDOOR_GOLDEN_HOUR']
    },
    cv: {
        label: 'CV / Applications',
        icon: '📄',
        presets: ['CV_MINIMALIST_WHITE']
    },
    personal_brand: {
        label: 'Personal Brand',
        icon: '🎨',
        presets: ['PERSONAL_BRAND_URBAN_CREATIVE']
    },
    speaker: {
        label: 'Speaker / Author',
        icon: '🎤',
        presets: ['SPEAKER_CONFERENCE_STAGE']
    },
    executive: {
        label: 'Executive',
        icon: '👔',
        presets: ['EXECUTIVE_DARK_STUDIO']
    },
    team: {
        label: 'Team Page',
        icon: '👥',
        presets: ['TEAM_PAGE_CORPORATE']
    },
    social: {
        label: 'Social Media',
        icon: '📱',
        presets: ['SOCIAL_MEDIA_LIFESTYLE']
    }
} as const

type CategoryKey = keyof typeof PRESET_CATEGORIES

// Get category for a preset ID
function getCategoryForPreset(presetId: string): CategoryKey | null {
    for (const [key, category] of Object.entries(PRESET_CATEGORIES)) {
        if ((category.presets as readonly string[]).includes(presetId)) {
            return key as CategoryKey
        }
    }
    return null
}

export default function PresetSelector({
    value,
    onChange,
    isPredefined = false,
    isDisabled = false,
    className = '',
    showHeader = false,
    availablePresets = {}
}: PresetSelectorProps) {
    const t = useTranslations('customization.photoStyle.preset')

    const currentPresetId = value?.value?.presetId || ''

    // Determine current category from preset ID
    const currentCategory = useMemo(() => {
        if (currentPresetId) {
            return getCategoryForPreset(currentPresetId)
        }
        // Default to first available category
        const availableKeys = Object.keys(availablePresets)
        if (availableKeys.length > 0) {
            return getCategoryForPreset(availableKeys[0])
        }
        return 'linkedin'
    }, [currentPresetId, availablePresets])

    // Filter categories to only show those with available presets
    const availableCategories = useMemo(() => {
        const categories: { key: CategoryKey; label: string; icon: string; presets: string[] }[] = []

        for (const [key, category] of Object.entries(PRESET_CATEGORIES)) {
            const availableInCategory = category.presets.filter(p => p in availablePresets)
            if (availableInCategory.length > 0) {
                categories.push({
                    key: key as CategoryKey,
                    label: category.label,
                    icon: category.icon,
                    presets: availableInCategory
                })
            }
        }
        return categories
    }, [availablePresets])

    // Get current category's available presets
    const currentCategoryPresets = useMemo(() => {
        if (!currentCategory) return []
        const category = PRESET_CATEGORIES[currentCategory]
        return category.presets.filter(p => p in availablePresets)
    }, [currentCategory, availablePresets])

    // Helper to preserve mode when updating value
    const wrapWithCurrentMode = (newValue: { presetId: string }): any => {
        return value?.mode === 'predefined' ? predefined(newValue) : userChoice(newValue)
    }

    const handleCategoryChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        if (isPredefined || isDisabled) return
        const newCategory = event.target.value as CategoryKey
        const categoryConfig = PRESET_CATEGORIES[newCategory]
        // Select first preset in new category
        const firstPreset = categoryConfig.presets.find(p => p in availablePresets) || categoryConfig.presets[0]
        onChange(wrapWithCurrentMode({ presetId: firstPreset }))
    }

    const handlePresetChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        if (isPredefined || isDisabled) return
        onChange(wrapWithCurrentMode({ presetId: event.target.value }))
    }

    if (availableCategories.length === 0) {
        return <div className="text-gray-500 text-sm italic">No presets available for this package.</div>
    }

    const selectClasses = `block w-full rounded-lg border-2 border-gray-200 p-3 pr-10 text-base focus:border-brand-primary focus:outline-none focus:ring-brand-primary sm:text-sm ${(isPredefined || isDisabled) ? 'cursor-not-allowed bg-gray-50' : 'cursor-pointer bg-white'
        }`

    return (
        <div className={`${className}`}>
            {showHeader && (
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                            {t('title', { default: 'Preset' })}
                        </h3>
                        <p className="hidden md:block text-sm text-gray-600">
                            {t('subtitle', { default: 'Choose a professional shot preset' })}
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
                {/* Category Selector */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('categoryLabel', { default: 'Category' })}
                    </label>
                    <select
                        value={currentCategory || ''}
                        onChange={handleCategoryChange}
                        disabled={isPredefined || isDisabled}
                        className={selectClasses}
                    >
                        {availableCategories.map((cat) => (
                            <option key={cat.key} value={cat.key}>
                                {cat.icon} {t(`categories.${cat.key}.label`, { default: cat.label })}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Sub-style Selector (only show if category has multiple presets) */}
                {currentCategoryPresets.length > 0 && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('styleLabel', { default: 'Style' })}
                        </label>
                        <select
                            value={currentPresetId}
                            onChange={handlePresetChange}
                            disabled={isPredefined || isDisabled}
                            className={selectClasses}
                        >
                            {currentCategoryPresets.map((presetId) => (
                                <option key={presetId} value={presetId}>
                                    {t(`presets.${presetId}.label`, { default: presetId.replace(/_/g, ' ').toLowerCase() })}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Selected Preset Description */}
                {currentPresetId && (
                    <p className="text-sm text-gray-600 px-1 py-2 bg-gray-50 rounded-lg">
                        {t(`presets.${currentPresetId}.description`, { default: '' })}
                    </p>
                )}
            </div>
        </div>
    )
}
