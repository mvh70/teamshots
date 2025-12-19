/**
 * EXAMPLE THIRD-PARTY PACKAGE
 *
 * This is a template demonstrating how to create a custom style package
 * that integrates with the TeamShots plugin architecture.
 *
 * To create your own package:
 * 1. Copy this _example-package folder to packages/your-package-name/
 * 2. Update the package metadata and configuration
 * 3. Implement your custom elements (optional)
 * 4. Implement buildGenerationPayload with your custom logic
 * 5. The package will auto-register on import!
 */

import type { ServerStylePackage, PackageMetadata } from '../types'
import type { PhotoStyleSettings } from '@/types/photo-style'
import type { GenerationContext, GenerationPayload } from '@/types/generation'
import { Logger } from '@/lib/logger'

// Import element composition system
import { StyleElement, type ElementContext, type ElementContribution } from '../../elements/base/StyleElement'

/**
 * OPTIONAL: Define custom elements for your package
 *
 * Elements encapsulate specific aspects of prompt generation.
 * You can create custom elements to add unique functionality.
 */
class CustomEffectElement extends StyleElement {
  readonly id = 'custom-effect'
  readonly name = 'Custom Effect'
  readonly description = 'Applies a custom visual effect to the image'

  // Priority determines execution order (lower = earlier)
  // Core elements: 10-70
  // Custom elements: 80+
  get priority(): number {
    return 80
  }

  // Determine if this element is relevant for the current phase
  isRelevantForPhase(context: ElementContext): boolean {
    const { phase, settings } = context

    // Only contribute if custom effect is enabled in settings
    // @ts-ignore - This is just an example
    if (!settings.customEffect || settings.customEffect === 'none') {
      return false
    }

    // Contribute to person generation and composition phases
    return phase === 'person-generation' || phase === 'composition'
  }

  // Generate prompt contributions for this element
  async contribute(context: ElementContext): Promise<ElementContribution> {
    const { settings } = context

    // @ts-ignore - This is just an example
    const effect = settings.customEffect

    return {
      instructions: [
        `Apply ${effect} visual effect to the final image`,
        'Ensure effect enhances rather than detracts from subject',
      ],
      mustFollow: [
        `${effect} effect must be subtle and professional`,
        'Subject must remain clearly visible through effect',
      ],
      metadata: {
        effectType: effect,
      },
    }
  }

  // Validate settings before generation
  validate(settings: PhotoStyleSettings): string[] {
    const errors: string[] = []

    // @ts-ignore - This is just an example
    const effect = settings.customEffect

    // Validate effect setting
    if (effect && !['none', 'subtle-blur', 'vignette', 'bokeh'].includes(effect)) {
      errors.push(`Invalid custom effect: ${effect}`)
    }

    return errors
  }
}

/**
 * Package Metadata
 *
 * Provides information about your package for discovery and validation
 */
const examplePackageMetadata: PackageMetadata = {
  author: 'Your Name or Company',
  description: 'Example package demonstrating plugin architecture',
  homepage: 'https://github.com/your-org/your-package',
  license: 'MIT',

  compatibility: {
    minVersion: '1.0.0',
    maxVersion: undefined, // No max version
    requires: [], // Package dependencies (e.g., ['headshot1'])
    optional: [], // Optional packages that enhance functionality
  },

  capabilities: {
    supportsCustomClothing: false,
    supportsBranding: true,
    supportsCustomBackgrounds: true,
    supportedWorkflowVersions: ['v3'], // Only support v3 workflow
    supportsAspectRatio: true,
    supportsPose: true,
    supportsExpression: true,
  },
}

/**
 * Package Configuration
 *
 * This is the main package export that gets registered
 */
export const examplePackage: ServerStylePackage = {
  // ===== REQUIRED FIELDS =====

  /**
   * Unique package identifier
   * Use lowercase with hyphens (e.g., 'my-custom-package')
   */
  id: 'example-package',

  /**
   * Display name shown to users
   */
  label: 'Example Package',

  /**
   * Package version (increment when you make changes)
   */
  version: 1,

  /**
   * Categories visible in the UI for user customization
   */
  visibleCategories: ['background', 'branding', 'pose', 'expression'],

  /**
   * Default settings for all categories
   */
  defaultSettings: {
    presetId: 'CORPORATE_HEADSHOT',
    background: { type: 'office' },
    branding: { type: 'exclude' },
    pose: { type: 'power_classic' },
    expression: { type: 'genuine_smile' },
    shotType: { type: 'headshot' },
    subjectCount: '1',
    aspectRatio: '1:1',
  },

  /**
   * Default preset ID
   */
  defaultPresetId: 'CORPORATE_HEADSHOT',

  /**
   * Build generation payload
   *
   * This is the core function that prepares data for AI generation.
   * You must implement this to define how your package creates images.
   */
  async buildGenerationPayload(context: GenerationContext): Promise<GenerationPayload> {
    const { generationId, styleSettings, selfieKeys } = context

    Logger.info('[ExamplePackage] Building generation payload', {
      generationId,
      selfieCount: selfieKeys.length,
    })

    // Example: Build a simple prompt
    const prompt = {
      task: 'Generate professional headshot',
      subject: {
        identity: `Synthesize from ${selfieKeys.length} selfie references`,
      },
      composition: {
        background: styleSettings.background?.type || 'office',
        pose: styleSettings.pose?.type || 'power_classic',
        expression: styleSettings.expression?.type || 'genuine_smile',
      },
    }

    return {
      prompt: JSON.stringify(prompt, null, 2),
      mustFollowRules: [
        'Match identity exactly from selfies',
        'Professional quality',
        'Natural lighting',
      ],
      freedomRules: ['Adjust minor details for best composition'],
      referenceImages: [],
      aspectRatio: styleSettings.aspectRatio || '1:1',
      aspectRatioDescription: 'Square format',
    }
  },

  /**
   * Extract UI settings from raw request data
   */
  extractUiSettings: (rawStyleSettings) => {
    return {
      presetId: 'CORPORATE_HEADSHOT',
      background: rawStyleSettings.background as PhotoStyleSettings['background'],
      branding: rawStyleSettings.branding as PhotoStyleSettings['branding'],
      pose: rawStyleSettings.pose as PhotoStyleSettings['pose'],
      expression: rawStyleSettings.expression as PhotoStyleSettings['expression'],
    }
  },

  /**
   * Persistence adapter for saving/loading settings
   */
  persistenceAdapter: {
    serialize: (ui) => ({
      package: 'example-package',
      settings: {
        background: ui.background,
        branding: ui.branding,
        pose: ui.pose,
        expression: ui.expression,
      },
    }),

    deserialize: (raw) => {
      const r = raw as Record<string, unknown>
      const inner = 'settings' in r ? (r.settings as Record<string, unknown>) : r

      return {
        presetId: 'CORPORATE_HEADSHOT',
        background: inner.background as PhotoStyleSettings['background'],
        branding: inner.branding as PhotoStyleSettings['branding'],
        pose: inner.pose as PhotoStyleSettings['pose'],
        expression: inner.expression as PhotoStyleSettings['expression'],
      }
    },
  },

  /**
   * Simple prompt builder for client-side preview
   */
  promptBuilder: (settings) => {
    return JSON.stringify(
      {
        background: settings.background?.type || 'office',
        pose: settings.pose?.type || 'power_classic',
      },
      null,
      2
    )
  },

  // ===== ENHANCED PLUGIN FIELDS =====

  /**
   * Feature flag to enable/disable this package
   * Set to undefined if always enabled
   */
  featureFlag: undefined, // Always enabled, or use 'myPackageFlag'

  /**
   * Package metadata
   */
  metadata: examplePackageMetadata,

  /**
   * Elements this package requires to be registered
   * The system will warn if these aren't available
   */
  requiredElements: ['subject', 'pose', 'expression'],

  /**
   * Custom elements this package provides
   * These will be auto-registered when the package registers
   */
  providedElements: [new CustomEffectElement()],

  // ===== LIFECYCLE HOOKS =====

  /**
   * Initialize package
   * Called once when package is first registered
   */
  async initialize() {
    Logger.info('[ExamplePackage] Initializing package')
    // Perform one-time setup here:
    // - Load external resources
    // - Connect to APIs
    // - Validate configuration
  },

  /**
   * Validate package configuration
   * Called before registration to ensure package is properly configured
   */
  async validate() {
    // Perform validation checks
    const errors: string[] = []
    const warnings: string[] = []

    // Example validation
    if (!this.defaultSettings) {
      errors.push('Default settings are required')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  },

  /**
   * Called after package is successfully registered
   */
  onRegister() {
    Logger.info('[ExamplePackage] Package registered successfully')
  },

  /**
   * Called before package is unregistered
   */
  onUnregister() {
    Logger.info('[ExamplePackage] Package unregistering')
    // Cleanup resources here
  },

  // ===== OPTIONAL: ASSET PREPARATION =====

  /**
   * Prepare assets before generation
   *
   * This runs in Step 0 before generation starts.
   * Use this to download, transform, or generate assets asynchronously.
   */
  async prepareAssets(context) {
    Logger.info('[ExamplePackage] Preparing assets', {
      generationId: context.generationId,
    })

    // Example: Prepare custom assets
    // return {
    //   'my-custom-asset': {
    //     base64: '...',
    //     mimeType: 'image/png',
    //     metadata: { ... }
    //   }
    // }

    return {}
  },
}

// ===== AUTO-REGISTRATION =====

/**
 * IMPORTANT: Packages self-register on import!
 *
 * When this module is imported, the package automatically registers
 * with the package registry. No manual registration required!
 */
import { packageRegistry } from '../registry'

// Only register in server environment
if (typeof window === 'undefined') {
  packageRegistry
    .register(examplePackage, { skipValidation: false })
    .then((result) => {
      if (result.valid) {
        Logger.info('[ExamplePackage] Auto-registration successful')
      } else {
        Logger.warn('[ExamplePackage] Auto-registration failed', {
          errors: result.errors,
          warnings: result.warnings,
        })
      }
    })
    .catch((error) => {
      Logger.error('[ExamplePackage] Auto-registration error', {
        error: error instanceof Error ? error.message : String(error),
      })
    })
}

// Export for external use
export default examplePackage
