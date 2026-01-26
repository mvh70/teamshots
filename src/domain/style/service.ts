import { PhotoStyleSettings } from '@/types/photo-style'
import { getPackageConfig } from './packages'
import { extractPackageId } from './settings-resolver'
import { hasValue } from './elements/base/element-types'

export type Scope = 'individual' | 'pro' | 'freePackage'

export async function loadStyle(params: { scope: Scope }) {
  const res = await fetch(`/api/styles/get?scope=${encodeURIComponent(params.scope)}`, { cache: 'no-store' })
  // Default to 'freepackage' for freePackage scope, otherwise 'headshot1'
  const defaultPackageId = params.scope === 'freePackage' ? 'freepackage' : 'headshot1'
  if (!res.ok) return { contextId: null, pkg: getPackageConfig(defaultPackageId), ui: getPackageConfig(defaultPackageId).defaultSettings }
  const data = await res.json() as { context?: { id: string; settings?: Record<string, unknown>; stylePreset?: string }, packageId?: string | null }
  // Use saved packageId if available, otherwise fall back to default
  const packageId = data.packageId || extractPackageId(data.context?.settings) || defaultPackageId
  const pkg = getPackageConfig(packageId)
  const ui: PhotoStyleSettings = data.context?.settings ? pkg.persistenceAdapter.deserialize(data.context.settings as Record<string, unknown>) : pkg.defaultSettings
  return { contextId: data.context?.id ?? null, pkg, ui }
}

export async function loadStyleByContextId(contextId: string) {
  const res = await fetch(`/api/styles/get?contextId=${encodeURIComponent(contextId)}`, { cache: 'no-store' })
  if (!res.ok) return { contextId: null, pkg: getPackageConfig('headshot1'), ui: getPackageConfig('headshot1').defaultSettings }
  const data = await res.json() as {
    context?: {
      id: string
      name?: string | null
      settings?: Record<string, unknown>
      packageName?: string
    }
    packageId?: string | null
  }
  const pkg = getPackageConfig(data.packageId || extractPackageId(data.context?.settings))
  const ui: PhotoStyleSettings = data.context?.settings ? pkg.persistenceAdapter.deserialize(data.context.settings as Record<string, unknown>) : pkg.defaultSettings
  return {
    contextId: data.context?.id ?? null,
    pkg,
    ui,
    context: data.context ?? null
  }
}

export async function saveStyle(params: { scope: Scope; contextId: string | null; packageId: string; ui: PhotoStyleSettings; name?: string }) {
  const pkg = getPackageConfig(params.packageId)

  // Free plan style is a global setting; use admin endpoint and payload shape
  if (params.scope === 'freePackage') {
    const backgroundType = params.ui.background?.value?.type ?? 'user-choice'
    const backgroundPrompt = params.ui.background?.value?.prompt ?? ''
    const brandingValue = hasValue(params.ui.branding) ? params.ui.branding.value : undefined
    const includeLogo = (brandingValue?.type ?? 'user-choice') === 'include'
    const stylePreset = pkg.defaultPresetId // Derive from package

    const res = await fetch('/api/admin/free-package-style/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contextId: params.contextId,
        stylePreset,
        background: backgroundType,
        includeLogo,
        backgroundPrompt,
        branding: params.ui.branding,
        backgroundSettings: params.ui.background,
        clothingSettings: params.ui.clothing,
        clothingColorsSettings: params.ui.clothingColors,
        shotTypeSettings: params.ui.shotType,
        expressionSettings: params.ui.expression,
        lightingSettings: params.ui.lighting,
        poseSettings: params.ui.pose,
        packageId: params.packageId || 'freepackage'
      })
    })
    return await res.json()
  }

  // Personal/Team styles are user-scoped; use generic styles save
  const settings = pkg.persistenceAdapter.serialize(params.ui)
  const stylePreset = pkg.defaultPresetId // Derive from package instead of ui.style?.preset
  const res = await fetch('/api/styles/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope: params.scope, contextId: params.contextId, packageId: params.packageId, stylePreset, settings, name: params.name })
  })
  return await res.json()
}

// New helpers to centralize style creation/update/activation. These operate under the
// "styles" domain (no separate contexts terminology).
export function deriveStyleName(scope: Scope, provided?: string | null): string {
  const trimmed = (provided ?? '').toString().trim()
  if (trimmed) return trimmed
  return scope === 'freePackage' ? 'Free Package Style' : 'unnamed'
}

export function getStylePresetForPackage(packageId: string): string {
  const pkg = getPackageConfig(packageId)
  return pkg.defaultPresetId
}

export async function createOrUpdateStyle(params: {
  scope: Scope
  styleId: string | null
  settings: Record<string, unknown>
  stylePreset: string
  name?: string | null
}): Promise<{ id: string }> {
  const body = {
    scope: params.scope,
    contextId: params.styleId, // kept for API back-compat; treated as styleId
    packageId: 'headshot1', // single package in current product scope
    stylePreset: params.stylePreset,
    settings: params.settings,
    name: params.name,
  }
  const res = await fetch('/api/styles/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const data = (await res.json()) as { contextId?: string; id?: string }
  const id = data.id || data.contextId || ''
  return { id }
}

export async function setActiveStyle(params: { styleId: string }): Promise<void> {
  await fetch(`/api/styles/${encodeURIComponent(params.styleId)}/activate`, { method: 'POST' })
}

export async function clearActiveStyle(params: { styleId: string }): Promise<void> {
  await fetch(`/api/styles/${encodeURIComponent(params.styleId)}/activate`, { method: 'DELETE' })
}
