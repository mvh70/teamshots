'use client'

import { useTranslations } from 'next-intl'
import type { AccessoryProfile } from '@/domain/selfie/selfieAccessories'
import type { BeautificationValue, RetouchingLevel, AccessoryAction } from '@/domain/style/elements/beautification/types'

interface BeautificationStepProps {
  value: BeautificationValue
  onChange: (value: BeautificationValue) => void
  accessories: AccessoryProfile | null
  isLoadingAccessories: boolean
}

const RETOUCHING_LEVELS: Array<{ key: RetouchingLevel; labelKey: string; descriptionKey: string }> = [
  { key: 'none', labelKey: 'retouching.levels.none.label', descriptionKey: 'retouching.levels.none.description' },
  { key: 'light', labelKey: 'retouching.levels.light.label', descriptionKey: 'retouching.levels.light.description' },
  { key: 'medium', labelKey: 'retouching.levels.medium.label', descriptionKey: 'retouching.levels.medium.description' },
  { key: 'high', labelKey: 'retouching.levels.high.label', descriptionKey: 'retouching.levels.high.description' },
]

const ACCESSORY_LABEL_KEYS: Record<string, string> = {
  glasses: 'accessories.labels.glasses',
  facialHair: 'accessories.labels.facialHair',
  jewelry: 'accessories.labels.jewelry',
  piercings: 'accessories.labels.piercings',
  tattoos: 'accessories.labels.tattoos',
}

function getDetectedAccessories(accessories: AccessoryProfile | null): string[] {
  if (!accessories) return []

  return Object.entries(accessories)
    .filter(([, value]) => Boolean(value?.detected))
    .map(([key]) => key)
}

function withAccessoryAction(
  value: BeautificationValue,
  key: keyof NonNullable<BeautificationValue['accessories']>,
  action: AccessoryAction
): BeautificationValue {
  return {
    ...value,
    accessories: {
      ...value.accessories,
      [key]: { action },
    },
  }
}

function RetouchingSlider({
  value,
  onChange,
  t,
}: {
  value: RetouchingLevel
  onChange: (level: RetouchingLevel) => void
  t: ReturnType<typeof useTranslations>
}) {
  const currentIndex = RETOUCHING_LEVELS.findIndex((l) => l.key === value)
  const currentLevel = RETOUCHING_LEVELS[currentIndex >= 0 ? currentIndex : 1]

  return (
    <div className="space-y-4">
      {/* Slider track */}
      <div className="relative px-1">
        {/* Track background */}
        <div className="relative h-2 rounded-full bg-gray-200">
          {/* Filled portion */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-brand-primary transition-all duration-200"
            style={{ width: `${(currentIndex / (RETOUCHING_LEVELS.length - 1)) * 100}%` }}
          />
        </div>

        {/* Clickable stops */}
        <div className="absolute inset-x-1 top-1/2 -translate-y-1/2 flex justify-between">
          {RETOUCHING_LEVELS.map((level, index) => {
            const isActive = index <= currentIndex
            const isCurrent = level.key === value
            return (
              <button
                key={level.key}
                type="button"
                onClick={() => onChange(level.key)}
                data-testid={`beautification-retouching-${level.key}`}
                className="group relative flex items-center justify-center"
                aria-label={t(level.labelKey)}
              >
                <span
                  className={`block rounded-full transition-all duration-200 ${
                    isCurrent
                      ? 'h-5 w-5 bg-brand-primary ring-4 ring-brand-primary/20'
                      : isActive
                        ? 'h-3 w-3 bg-brand-primary'
                        : 'h-3 w-3 bg-gray-300 group-hover:bg-gray-400'
                  }`}
                />
              </button>
            )
          })}
        </div>
      </div>

      {/* Labels below slider */}
      <div className="flex justify-between px-0">
        {RETOUCHING_LEVELS.map((level) => (
          <button
            key={level.key}
            type="button"
            onClick={() => onChange(level.key)}
            className={`text-xs font-medium transition-colors ${
              level.key === value ? 'text-brand-primary' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {t(level.labelKey)}
          </button>
        ))}
      </div>

      {/* Current level description */}
      {currentLevel && (
        <p className="text-sm text-gray-600 px-1">
          {t(currentLevel.descriptionKey)}
        </p>
      )}
    </div>
  )
}

function AccessoryToggle({
  label,
  isKeep,
  onToggle,
  testId,
  keepLabel,
  removeLabel,
}: {
  label: string
  isKeep: boolean
  onToggle: (keep: boolean) => void
  testId: string
  keepLabel: string
  removeLabel: string
}) {
  return (
    <div
      data-testid={testId}
      className="flex items-center justify-between gap-3 py-3"
    >
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-medium text-gray-900">{label}</span>
        <span className="text-xs text-gray-500">
          {isKeep ? keepLabel : removeLabel}
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={isKeep}
        onClick={() => onToggle(!isKeep)}
        data-testid={`${testId}-toggle`}
        className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 ${
          isKeep ? 'bg-brand-primary' : 'bg-gray-200'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            isKeep ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

export default function BeautificationStep({
  value,
  onChange,
  accessories,
  isLoadingAccessories,
}: BeautificationStepProps) {
  const t = useTranslations('beautification')
  const detectedAccessories = getDetectedAccessories(accessories)

  return (
    <div className="w-full space-y-6">
      {/* Retouching section */}
      <section data-testid="beautification-retouching-section" className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{t('retouching.title')}</h3>
        </div>
        <RetouchingSlider
          value={value.retouching}
          onChange={(level) => onChange({ ...value, retouching: level })}
          t={t}
        />
      </section>

      {/* Accessories section */}
      <section data-testid="beautification-accessories-section" className="space-y-2">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{t('accessories.title')}</h3>
        </div>

        {isLoadingAccessories && (
          <div className="space-y-3 pt-2">
            <div className="h-14 animate-pulse rounded-lg bg-gray-100" />
            <div className="h-14 animate-pulse rounded-lg bg-gray-100" />
          </div>
        )}

        {!isLoadingAccessories && detectedAccessories.length === 0 && (
          <p className="text-sm text-gray-500 pt-1">{t('accessories.empty')}</p>
        )}

        {!isLoadingAccessories && detectedAccessories.length > 0 && (
          <div className="divide-y divide-gray-100">
            {detectedAccessories.map((accessoryKey) => {
              const key = accessoryKey as keyof NonNullable<BeautificationValue['accessories']>
              const action = value.accessories?.[key]?.action ?? 'keep'
              const accessoryLabelKey = ACCESSORY_LABEL_KEYS[accessoryKey]
              return (
                <AccessoryToggle
                  key={accessoryKey}
                  label={accessoryLabelKey ? t(accessoryLabelKey) : accessoryKey}
                  isKeep={action === 'keep'}
                  onToggle={(keep) =>
                    onChange(withAccessoryAction(value, key, keep ? 'keep' : 'remove'))
                  }
                  testId={`beautification-accessory-${accessoryKey}`}
                  keepLabel={t('accessories.actions.keep')}
                  removeLabel={t('accessories.actions.remove')}
                />
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
