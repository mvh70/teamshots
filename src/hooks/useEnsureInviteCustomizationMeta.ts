'use client'

import { useEffect } from 'react'
import { getElements } from '@/domain/style/elements'
import '@/domain/style/elements/init-registry'
import { getPackageConfig } from '@/domain/style/packages'
import { getSettingMode } from '@/domain/style/setting-mode'
import type { CustomizationStepsMeta } from '@/lib/customizationSteps'
import { isRecord } from '@/lib/type-guards'

function buildMetaFromContext(
  rawSettings: Record<string, unknown>,
  packageId: string
): CustomizationStepsMeta {
  const pkg = getPackageConfig(packageId)
  const allCategories = getElements(pkg.visibleCategories)

  const editableCategories = allCategories.filter((category) =>
    getSettingMode(category.key, rawSettings[category.key]) === 'user-choice'
  )
  const editableSet = new Set(editableCategories.map((category) => category.key))
  const lockedCategories = allCategories.filter((category) => !editableSet.has(category.key))
  const orderedCategories = [...editableCategories, ...lockedCategories]

  return {
    editableSteps: editableCategories.length,
    allSteps: orderedCategories.length,
    lockedSteps: orderedCategories
      .map((category, idx) => (editableSet.has(category.key) ? -1 : idx))
      .filter((idx) => idx >= 0),
    stepNames: editableCategories.map((category) => category.label),
    stepKeys: editableCategories.map((category) => category.key),
  }
}

interface UseEnsureInviteCustomizationMetaParams {
  token: string
  currentMeta: CustomizationStepsMeta
  setCustomizationStepsMeta: (meta: CustomizationStepsMeta) => void
}

export function useEnsureInviteCustomizationMeta({
  token,
  currentMeta,
  setCustomizationStepsMeta,
}: UseEnsureInviteCustomizationMetaParams) {
  useEffect(() => {
    if (!token) return

    // If step keys are present, assume we already have computed metadata.
    if (Array.isArray(currentMeta.stepKeys) && currentMeta.stepKeys.length > 0) {
      return
    }

    let cancelled = false

    const load = async () => {
      try {
        const response = await fetch(`/api/team/member/context?token=${encodeURIComponent(token)}`, {
          cache: 'no-store',
        })
        if (!response.ok) return

        const payload = (await response.json()) as {
          context?: { settings?: Record<string, unknown> | null } | null
          packageId?: string
        }
        const rawSettings = payload.context?.settings
        if (!isRecord(rawSettings)) return

        // API returns either flat settings or { package, settings } wrapper.
        const effectiveSettings = isRecord(rawSettings.settings)
          ? rawSettings.settings
          : rawSettings

        const packageId =
          typeof payload.packageId === 'string'
            ? payload.packageId
            : typeof rawSettings.package === 'string'
              ? rawSettings.package
              : 'headshot1'

        const computed = buildMetaFromContext(effectiveSettings, packageId)

        if (!cancelled) {
          setCustomizationStepsMeta(computed)
        }
      } catch {
        // Non-blocking enhancement: keep existing metadata on fetch failures.
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [token, currentMeta.stepKeys, setCustomizationStepsMeta])
}
