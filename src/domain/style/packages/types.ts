/**
 * Enhanced Package Type Definitions
 *
 * Extends the base package interfaces with:
 * - Lifecycle hooks
 * - Element binding
 * - Metadata and capabilities
 * - Dependency management
 */

import type { CategoryType, PhotoStyleSettings } from '@/types/photo-style'
import type { GenerationContext, GenerationPayload } from '@/types/generation'
import type { StyleElement } from '../elements/base/StyleElement'
import type { StandardPresetConfig } from './defaults'

/**
 * Package metadata for discovery and compatibility
 */
export interface PackageMetadata {
  /** Package author */
  author?: string

  /** Package description */
  description?: string

  /** Homepage or documentation URL */
  homepage?: string

  /** License identifier (e.g., 'MIT', 'Apache-2.0') */
  license?: string

  /** Version compatibility */
  compatibility?: {
    /** Minimum system version */
    minVersion?: string

    /** Maximum system version */
    maxVersion?: string

    /** Required packages (dependencies) */
    requires?: string[]

    /** Optional packages that enhance functionality */
    optional?: string[]
  }

  /** Package capabilities */
  capabilities?: PackageCapabilities
}

/**
 * Package capabilities declaration
 */
export interface PackageCapabilities {
  /** Supports multiple subjects in one image */
  supportsMultipleSubjects?: boolean

  /** Supports custom backgrounds */
  supportsCustomBackgrounds?: boolean

  /** Supports custom clothing/outfits */
  supportsCustomClothing?: boolean

  /** Supports branding/logos */
  supportsBranding?: boolean

  /** Supported workflow versions */
  supportedWorkflowVersions?: Array<'v3'>

  /** Supports aspect ratio customization */
  supportsAspectRatio?: boolean

  /** Supports pose customization */
  supportsPose?: boolean

  /** Supports expression customization */
  supportsExpression?: boolean
}

/**
 * Validation result for package validation
 */
export interface PackageValidationResult {
  valid: boolean
  errors: string[]
  warnings?: string[]
}

/**
 * Base client-side package interface (no changes from original)
 */
export interface ClientStylePackage {
  id: string
  label: string
  version: number
  visibleCategories: CategoryType[]

  /** Categories that belong to "Composition Settings" section */
  compositionCategories?: CategoryType[]

  /** Categories that belong to "User Style Settings" section */
  userStyleCategories?: CategoryType[]

  availableBackgrounds?: string[]
  availablePoses?: string[]
  availableExpressions?: string[]
  defaultSettings: PhotoStyleSettings
  defaultPresetId: string
  presets?: Record<string, StandardPresetConfig>

  promptBuilder: (
    settings: PhotoStyleSettings,
    ctx?: Record<string, unknown>
  ) => string | Record<string, unknown>

  forPreviewPromptBuilder?: (
    settings: PhotoStyleSettings,
    ctx?: Record<string, unknown>
  ) => string | Record<string, unknown>

  persistenceAdapter: {
    serialize: (ui: PhotoStyleSettings) => Record<string, unknown>
    deserialize: (raw: Record<string, unknown>) => PhotoStyleSettings
  }

  extractUiSettings: (rawStyleSettings: Record<string, unknown>) => PhotoStyleSettings

  resolveStandardPreset?: (
    preset: StandardPresetConfig,
    styleSettings: PhotoStyleSettings
  ) => StandardPresetConfig

  // --- NEW: Enhanced fields for plugin architecture ---

  /** Feature flag to enable/disable this package */
  featureFlag?: string

  /** Package metadata */
  metadata?: PackageMetadata

  /** Elements this package requires to be registered */
  requiredElements?: string[]

  /** Elements this package provides (will be auto-registered) */
  providedElements?: StyleElement[]

  /** Lifecycle hook: called after package is registered */
  onRegister?(): void | Promise<void>

  /** Lifecycle hook: called before package is unregistered */
  onUnregister?(): void | Promise<void>

  /** Lifecycle hook: one-time initialization */
  initialize?(): Promise<void>

  /** Validate package configuration */
  validate?(): PackageValidationResult | Promise<PackageValidationResult>
}

/**
 * Server-side package interface with generation capabilities
 */
export interface ServerStylePackage extends ClientStylePackage {
  /**
   * Build generation payload for this package
   *
   * This is the core server-side function that prepares all data
   * needed for AI image generation.
   */
  buildGenerationPayload: (context: GenerationContext) => Promise<GenerationPayload>

  /**
   * Optional: Prepare assets before generation
   *
   * This hook allows packages to download, transform, or generate
   * assets asynchronously before the main generation workflow.
   *
   * Example: Creating garment collages, downloading logos, etc.
   */
  prepareAssets?: (context: GenerationContext) => Promise<PackagePreparedAssets>
}

/**
 * Assets prepared by a package
 */
export interface PackagePreparedAssets {
  /** Asset key-value pairs */
  [key: string]: {
    base64: string
    mimeType: string
    metadata?: Record<string, unknown>
  }
}

/**
 * Type guard to check if package is a server package
 */
export function isServerPackage(pkg: ClientStylePackage): pkg is ServerStylePackage {
  return 'buildGenerationPayload' in pkg && typeof pkg.buildGenerationPayload === 'function'
}

/**
 * Type guard to check if package has preparation capability
 */
export function canPrepareAssets(pkg: ServerStylePackage): pkg is ServerStylePackage & Required<Pick<ServerStylePackage, 'prepareAssets'>> {
  return 'prepareAssets' in pkg && typeof pkg.prepareAssets === 'function'
}
