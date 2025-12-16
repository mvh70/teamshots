/**
 * Element Metadata Registry
 *
 * Each style element defines its own UI metadata (label, icon, description).
 * This allows packages to reference elements by key, and the UI to dynamically
 * render them without hardcoded category lists.
 */

import type { ComponentType, SVGProps } from 'react'
import type { CategoryType } from '@/types/photo-style'

export interface ElementMetadata {
  key: CategoryType
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  description: string
  /** Group this element belongs to for UI organization */
  group: 'composition' | 'userStyle'
}

/**
 * Registry of all available style elements
 * Each element exports its metadata from its own folder
 */
export const ELEMENT_REGISTRY: Record<CategoryType, ElementMetadata> = {} as Record<CategoryType, ElementMetadata>

/**
 * Register an element's metadata
 */
export function registerElement(metadata: ElementMetadata): void {
  ELEMENT_REGISTRY[metadata.key] = metadata
}

/**
 * Get metadata for a specific element
 */
export function getElementMetadata(key: CategoryType): ElementMetadata | undefined {
  return ELEMENT_REGISTRY[key]
}

/**
 * Get all registered elements
 */
export function getAllElements(): ElementMetadata[] {
  return Object.values(ELEMENT_REGISTRY)
}

/**
 * Get elements filtered by keys
 */
export function getElements(keys: CategoryType[]): ElementMetadata[] {
  return keys
    .map(key => ELEMENT_REGISTRY[key])
    .filter((meta): meta is ElementMetadata => meta !== undefined)
}
