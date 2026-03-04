'use client'

import { useTranslations } from 'next-intl'
import { ClothingSettings, ClothingColorSettings, ClothingValue, ClothingType } from '@/types/photo-style'
import { predefined, hasValue, userChoice } from '../base/element-types'
import { Grid } from '@/components/ui'
import {
  CLOTHING_STYLES,
  getAccessoriesForClothing,
  getDetailsByGenderForStyle,
  getTopChoicesForUser,
  getBottomChoicesForUser,
  getOuterChoicesForUser,
  getOnePieceChoicesForUser,
  getEffectiveClothingDetail,
  normalizeClothingValueWithChoices,
} from './config'
import type { ClothingMode } from './types'
import { useEffect, useCallback, useMemo } from 'react'
import ClothingColorPreview from '../clothing-colors/ClothingColorPreview'
import type { ClothingColorKey } from '../clothing-colors/types'

interface ClothingSelectorProps {
  value: ClothingSettings
  onChange: (settings: ClothingSettings) => void
  clothingColors?: ClothingColorSettings
  excludeColors?: ClothingColorKey[]
  availableStyles?: string[]
  isPredefined?: boolean
  isDisabled?: boolean
  suppressAutoSelect?: boolean
  className?: string
  showHeader?: boolean
  styleLocked?: boolean
  adminStyleOnly?: boolean
  detectedGender?: string
}

function areValuesEqual(a?: ClothingValue, b?: ClothingValue): boolean {
  return JSON.stringify(a || null) === JSON.stringify(b || null)
}

function toLabel(value: string): string {
  return value
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function buildDefaultValue(style: ClothingType, mode: ClothingMode, lockScope?: 'style-only'): ClothingValue {
  return normalizeClothingValueWithChoices({
    style,
    mode,
    lockScope,
  })
}

export default function ClothingSelector({
  value,
  onChange,
  clothingColors,
  excludeColors = [],
  availableStyles,
  isPredefined = false,
  isDisabled = false,
  suppressAutoSelect = false,
  className = '',
  showHeader = false,
  styleLocked = false,
  adminStyleOnly = false,
  detectedGender,
}: ClothingSelectorProps) {
  const t = useTranslations('customization.photoStyle.clothing')

  const filteredClothingStyles = useMemo(() => {
    const styleFiltered = availableStyles
      ? CLOTHING_STYLES.filter((style) => availableStyles.includes(style.value))
      : CLOTHING_STYLES

    // Team admin must set only broad styles (no black tie selection).
    if (adminStyleOnly) {
      return styleFiltered.filter((style) => style.value !== 'black-tie')
    }

    return styleFiltered
  }, [availableStyles, adminStyleOnly])

  const clothingValue = hasValue(value) ? value.value : undefined
  const selectableStyles = useMemo(() => {
    if (!styleLocked || !clothingValue?.style) return filteredClothingStyles
    if (filteredClothingStyles.some((style) => style.value === clothingValue.style)) {
      return filteredClothingStyles
    }
    const lockedStyle = CLOTHING_STYLES.find((style) => style.value === clothingValue.style)
    return lockedStyle ? [...filteredClothingStyles, lockedStyle] : filteredClothingStyles
  }, [clothingValue?.style, filteredClothingStyles, styleLocked])

  const fallbackStyle = selectableStyles[0]?.value as ClothingType | undefined
  const displayStyle = (clothingValue?.style || fallbackStyle) as ClothingType | undefined

  const displayClothingValue = useMemo(() => {
    if (!displayStyle) return undefined
    if (!clothingValue) {
      return adminStyleOnly
        ? ({ style: displayStyle, lockScope: value?.mode === 'predefined' ? 'style-only' : undefined } as ClothingValue)
        : buildDefaultValue(displayStyle, 'separate', value?.mode === 'predefined' ? 'style-only' : undefined)
    }
    return normalizeClothingValueWithChoices({
      ...clothingValue,
      style: displayStyle,
      lockScope: value?.mode === 'predefined' ? 'style-only' : clothingValue.lockScope,
    })
  }, [adminStyleOnly, clothingValue, displayStyle, value?.mode])

  const currentMode: ClothingMode = displayClothingValue?.mode || 'separate'
  const topChoices = useMemo(() => displayStyle ? getTopChoicesForUser(displayStyle, detectedGender) : [], [displayStyle, detectedGender])
  const bottomChoices = useMemo(() => displayStyle ? getBottomChoicesForUser(displayStyle, detectedGender) : [], [displayStyle, detectedGender])
  const outerChoices = useMemo(() => displayStyle ? getOuterChoicesForUser(displayStyle, detectedGender) : [], [displayStyle, detectedGender])
  const onePieceChoices = useMemo(() => displayStyle ? getOnePieceChoicesForUser(displayStyle, detectedGender) : [], [displayStyle, detectedGender])

  const detailsByGender = useMemo(() => {
    if (!displayStyle) {
      return { male: [], female: [], neutral: [] }
    }
    return getDetailsByGenderForStyle(displayStyle)
  }, [displayStyle])

  const adminChoiceBuckets = useMemo(() => {
    const base = [...detailsByGender.neutral, ...detailsByGender.male]
    return {
      choices: base,
      extraFemaleChoices: detailsByGender.female,
    }
  }, [detailsByGender])

  const effectiveDetail = useMemo(
    () => getEffectiveClothingDetail(displayStyle, displayClothingValue),
    [displayStyle, displayClothingValue]
  )

  const wrapWithCurrentMode = useCallback((newValue: ClothingValue): ClothingSettings => {
    if (value?.mode === 'predefined') {
      return predefined(newValue)
    }
    return userChoice(newValue)
  }, [value?.mode])

  // Keep the current value valid as style filters, gender, or lock mode changes.
  useEffect(() => {
    if (isDisabled) return
    // In style-locked user flow, avoid mount-time auto-normalization writes.
    // Those writes are interpreted as user visits upstream and incorrectly mark
    // the card as completed before the user picks a substyle/detail.
    if (styleLocked && !adminStyleOnly) return
    if (selectableStyles.length === 0) return

    const firstStyle = selectableStyles[0].value as ClothingType
    let nextValue: ClothingValue | undefined

    if (!clothingValue?.style) {
      if (!suppressAutoSelect) {
        nextValue = adminStyleOnly
          ? {
              style: firstStyle,
              lockScope: value?.mode === 'predefined' ? 'style-only' : undefined,
            }
          : buildDefaultValue(firstStyle, 'separate', value?.mode === 'predefined' ? 'style-only' : undefined)
      }
    } else {
      let nextStyle = clothingValue.style
      const styleStillAllowed = selectableStyles.some((style) => style.value === nextStyle)

      if (!styleStillAllowed && !styleLocked) {
        nextStyle = firstStyle
      }

      const candidate = adminStyleOnly
        ? {
            style: nextStyle,
            lockScope: value?.mode === 'predefined' ? 'style-only' : clothingValue.lockScope,
          }
        : normalizeClothingValueWithChoices({
            ...clothingValue,
            style: nextStyle,
            lockScope: value?.mode === 'predefined' ? 'style-only' : clothingValue.lockScope,
          })

      if (!areValuesEqual(candidate as ClothingValue, clothingValue)) {
        nextValue = candidate as ClothingValue
      }
    }

    if (nextValue) {
      onChange(wrapWithCurrentMode(nextValue))
    }
  }, [
    adminStyleOnly,
    clothingValue,
    isDisabled,
    onChange,
    selectableStyles,
    styleLocked,
    suppressAutoSelect,
    value?.mode,
    wrapWithCurrentMode,
  ])

  const handleStyleChange = (style: ClothingType) => {
    if (isDisabled || styleLocked) return

    const newValue: ClothingValue = adminStyleOnly
      ? {
          style,
          lockScope: value?.mode === 'predefined' ? 'style-only' : undefined,
        }
      : buildDefaultValue(style, currentMode, value?.mode === 'predefined' ? 'style-only' : undefined)

    onChange(wrapWithCurrentMode(newValue))
  }

  const handleModeChange = (mode: ClothingMode) => {
    if (isDisabled || adminStyleOnly || !displayStyle) return

    const baseValue = normalizeClothingValueWithChoices({
      ...(displayClothingValue || { style: displayStyle }),
      mode,
      lockScope: value?.mode === 'predefined' ? 'style-only' : displayClothingValue?.lockScope,
    })

    const allowedAccessories = getAccessoriesForClothing(displayStyle, getEffectiveClothingDetail(displayStyle, baseValue), detectedGender)
    const currentAccessories = Array.isArray(displayClothingValue?.accessories) ? displayClothingValue!.accessories! : []

    onChange(
      wrapWithCurrentMode({
        ...baseValue,
        accessories: currentAccessories.filter((accessory) => allowedAccessories.includes(accessory)),
      })
    )
  }

  const updateChoice = (patch: Partial<ClothingValue>) => {
    if (isDisabled || adminStyleOnly || !displayStyle) return

    const next = normalizeClothingValueWithChoices({
      ...(displayClothingValue || { style: displayStyle }),
      ...patch,
      lockScope: value?.mode === 'predefined' ? 'style-only' : displayClothingValue?.lockScope,
    })

    const allowedAccessories = getAccessoriesForClothing(displayStyle, getEffectiveClothingDetail(displayStyle, next), detectedGender)
    const currentAccessories = Array.isArray(displayClothingValue?.accessories) ? displayClothingValue!.accessories! : []

    onChange(
      wrapWithCurrentMode({
        ...next,
        accessories: currentAccessories.filter((accessory) => allowedAccessories.includes(accessory)),
      })
    )
  }

  const handleAccessoryToggle = (accessory: string) => {
    if (isDisabled || adminStyleOnly) return
    if (!displayStyle) return

    const currentAccessories = displayClothingValue?.accessories || []
    const newAccessories = currentAccessories.includes(accessory)
      ? currentAccessories.filter((a: string) => a !== accessory)
      : [...currentAccessories, accessory]

    onChange(
      wrapWithCurrentMode({
        ...(displayClothingValue || { style: displayStyle }),
        accessories: newAccessories,
      })
    )
  }

  const styleSelectDisabled = isDisabled || styleLocked

  return (
    <div className={className}>
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {t('title', { default: 'Clothing Style' })}
            </h3>
            <p className="hidden md:block text-sm text-gray-600">
              {t('subtitle', { default: 'Choose clothing style and accessories' })}
            </p>
          </div>
          {isPredefined && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {t('predefined', { default: 'Predefined' })}
            </span>
          )}
        </div>
      )}

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('stylesLabel', { default: 'Style' })}
        </label>
        <select
          value={displayStyle || ''}
          onChange={(e) => handleStyleChange(e.target.value as ClothingType)}
          disabled={styleSelectDisabled}
          className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary ${
            styleSelectDisabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'bg-white'
          }`}
        >
          {selectableStyles.map((style) => (
            <option key={style.value} value={style.value}>
              {style.icon} {t(`styles.${style.value}.label`, { default: style.value })}
            </option>
          ))}
        </select>
        {styleLocked && !adminStyleOnly && (
          <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
            {t('styleLockedByAdmin', { default: 'Main style is fixed. You can still choose outfit pieces below.' })}
          </p>
        )}
        {adminStyleOnly && displayStyle && (
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-700 mb-2">
              Substyles team members can choose
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="font-semibold text-slate-600 mb-1">Choices</p>
                <p className="text-slate-700">
                  {adminChoiceBuckets.choices.length > 0
                    ? adminChoiceBuckets.choices.map((detail) => t(`details_options.${detail}`, { default: detail })).join(', ')
                    : '-'}
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-600 mb-1">Additional female choices</p>
                <p className="text-slate-700">
                  {adminChoiceBuckets.extraFemaleChoices.length > 0
                    ? adminChoiceBuckets.extraFemaleChoices.map((detail) => t(`details_options.${detail}`, { default: detail })).join(', ')
                    : '-'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {displayStyle && !adminStyleOnly && (
        <div className={`space-y-6 ${isDisabled ? 'opacity-60 pointer-events-none' : ''}`}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('mode.label', { default: 'Outfit Structure' })}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleModeChange('separate')}
                className={`px-3 py-2 rounded border text-sm ${
                  currentMode === 'separate'
                    ? 'border-brand-primary bg-brand-primary-light text-brand-primary'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                {t('mode.separate', { default: 'Top + Bottom' })}
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('one_piece')}
                className={`px-3 py-2 rounded border text-sm ${
                  currentMode === 'one_piece'
                    ? 'border-brand-primary bg-brand-primary-light text-brand-primary'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                {t('mode.onePiece', { default: 'One-piece' })}
              </button>
            </div>
          </div>

          {currentMode === 'separate' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('outer.label', { default: 'Top Layer (Optional)' })}
                </label>
                <select
                  value={displayClothingValue?.outerChoice || ''}
                  onChange={(e) => updateChoice({ mode: 'separate', outerChoice: e.target.value })}
                  disabled={isDisabled || outerChoices.length === 0}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary ${
                    isDisabled || outerChoices.length === 0 ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'bg-white'
                  }`}
                >
                  <option value="">{t('outer.none', { default: 'No top layer' })}</option>
                  {outerChoices.map((choice) => (
                    <option key={choice} value={choice}>
                      {t(`details_options.${choice}`, { default: toLabel(choice) })}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('top.label', { default: 'Base Layer' })}
                </label>
                <select
                  value={displayClothingValue?.topChoice || ''}
                  onChange={(e) => updateChoice({ mode: 'separate', topChoice: e.target.value })}
                  disabled={isDisabled || topChoices.length === 0}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary ${
                    isDisabled || topChoices.length === 0 ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'bg-white'
                  }`}
                >
                  {topChoices.map((choice) => (
                    <option key={choice} value={choice}>
                      {t(`details_options.${choice}`, { default: toLabel(choice) })}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('bottom.label', { default: 'Bottom Layer' })}
                </label>
                <select
                  value={displayClothingValue?.bottomChoice || ''}
                  onChange={(e) => updateChoice({ mode: 'separate', bottomChoice: e.target.value })}
                  disabled={isDisabled || bottomChoices.length === 0}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary ${
                    isDisabled || bottomChoices.length === 0 ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'bg-white'
                  }`}
                >
                  {bottomChoices.map((choice) => (
                    <option key={choice} value={choice}>
                      {t(`details_options.${choice}`, { default: toLabel(choice) })}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('onePiece.label', { default: 'One-piece Garment' })}
              </label>
              <select
                value={displayClothingValue?.onePieceChoice || ''}
                onChange={(e) => updateChoice({ mode: 'one_piece', onePieceChoice: e.target.value })}
                disabled={isDisabled || onePieceChoices.length === 0}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary ${
                  isDisabled || onePieceChoices.length === 0 ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'bg-white'
                }`}
              >
                {onePieceChoices.map((choice) => (
                  <option key={choice} value={choice}>
                    {t(`details_options.${choice}`, { default: toLabel(choice) })}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">
                {t('accessories.label', { default: 'Accessories' })}
              </label>
            </div>
            <Grid cols={{ mobile: 2 }} gap="sm" className="p-3 border border-gray-200 rounded-lg bg-gray-50">
              {getAccessoriesForClothing(displayStyle, effectiveDetail, detectedGender).map((accessory) => {
                const isSelected = displayClothingValue?.accessories?.includes(accessory) || false
                return (
                  <button
                    type="button"
                    key={accessory}
                    onClick={() => handleAccessoryToggle(accessory)}
                    className={`p-2 text-xs rounded border transition-colors flex items-center gap-1.5 ${
                      isSelected
                        ? 'border-brand-primary bg-brand-primary-light text-brand-primary'
                        : 'border-gray-300 hover:border-gray-400 text-gray-700'
                    }`}
                  >
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-primary"></span>
                    )}
                    {accessory}
                  </button>
                )
              })}
            </Grid>
          </div>

          <div className="mt-6">
            <ClothingColorPreview
              colors={clothingColors && hasValue(clothingColors) ? clothingColors.value : {}}
              clothingStyle={displayStyle}
              clothingDetail={effectiveDetail}
              clothingValue={displayClothingValue}
              excludeColors={excludeColors}
            />
          </div>
        </div>
      )}
    </div>
  )
}
