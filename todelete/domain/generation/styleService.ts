import { PhotoStyleSettings } from '@/types/photo-style'
import { getPackageConfig } from '@/domain/generation/packages'

export type Scope = 'individual' | 'pro' | 'freePackage'

export async function loadStyle(params: { scope: Scope }) {
  const res = await fetch(`/api/styles/get?scope=${encodeURIComponent(params.scope)}`, { cache: 'no-store' })
  if (!res.ok) return { contextId: null, pkg: getPackageConfig('headshot1'), ui: getPackageConfig('headshot1').defaultSettings }
  const data = await res.json() as { context?: { id: string; settings?: Record<string, unknown>; stylePreset?: string }, packageId?: string | null }
  const pkg = getPackageConfig(data.packageId || (data.context?.settings?.['packageId'] as string | undefined))
  const ui: PhotoStyleSettings = data.context?.settings ? pkg.persistenceAdapter.deserialize(data.context.settings as Record<string, unknown>) : pkg.defaultSettings
  return { contextId: data.context?.id ?? null, pkg, ui }
}

export async function saveStyle(params: { scope: Scope; contextId: string | null; packageId: string; ui: PhotoStyleSettings }) {
  const pkg = getPackageConfig(params.packageId)
  const settings = pkg.persistenceAdapter.serialize(params.ui)
  const stylePreset = params.ui.style?.preset ?? 'corporate'
  const res = await fetch('/api/styles/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope: params.scope, contextId: params.contextId, packageId: params.packageId, stylePreset, settings })
  })
  return await res.json()
}
