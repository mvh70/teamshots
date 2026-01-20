/**
 * Element-Level Prompt Composition System
 *
 * Elements are self-contained, composable pieces that contribute prompt instructions
 * at specific workflow phases. This allows for:
 * - Separation of concerns (branding, clothing, camera, etc.)
 * - Reusability across packages
 * - Phase-aware prompt building
 * - Independent testing and maintenance
 */

import type { PhotoStyleSettings } from '@/types/photo-style'

/**
 * Workflow phases where elements can contribute
 */
export type WorkflowPhase =
  | 'preparation'            // Step 0: Prepare assets (download, create collages, etc.)
  | 'person-generation'      // Step 1a: Generate person
  | 'background-generation'  // Step 1b: Generate background
  | 'composition'            // Step 2: Compose person + background
  | 'evaluation'             // Step 3: Evaluate result

/**
 * Reference image that can be included in prompts
 */
export interface ReferenceImage {
  url: string
  description: string
  type?: 'selfie' | 'clothing' | 'branding' | 'background' | 'other'
}

/**
 * Asset prepared during preparation phase
 *
 * Elements can prepare expensive assets (downloads, collages, etc.) in the
 * preparation phase and retrieve them in later phases via ElementContext
 */
export interface PreparedAsset {
  // Element that prepared this asset
  elementId: string

  // Type of asset (for identification)
  assetType: string

  // The prepared data (base64 image, URL, or other data)
  data: {
    base64?: string
    mimeType?: string
    url?: string
    s3Key?: string
    metadata?: Record<string, unknown>
  }
}

/**
 * Contribution from an element to a specific phase
 */
export interface ElementContribution {
  // Prompt instructions to add
  instructions?: string[]

  // Rules that must be followed
  mustFollow?: string[]

  // Creative freedom allowed
  freedom?: string[]

  // Reference images to include
  referenceImages?: ReferenceImage[]

  // Structured data for the AI model
  metadata?: Record<string, unknown>

  /**
   * JSON payload fragment to contribute to the generation prompt
   *
   * This payload will be deep-merged with other elements' payloads in priority order.
   * Elements should use clear paths to avoid conflicts (e.g., 'subject.wardrobe', 'scene.environment').
   *
   * Example contribution from ClothingElement:
   * ```typescript
   * {
   *   subject: {
   *     wardrobe: {
   *       style: 'business-casual',
   *       style_key: 'business_casual',
   *       colors: ['navy', 'white']
   *     }
   *   }
   * }
   * ```
   *
   * Merging behavior:
   * - Deep merge preserves nested structures
   * - Later elements can override specific fields
   * - Elements can read accumulated payload via context.accumulatedPayload
   */
  payload?: Record<string, unknown>
}

/**
 * Context provided to elements for decision-making
 */
export interface ElementContext {
  // Current workflow phase
  phase: WorkflowPhase

  // All user settings
  settings: PhotoStyleSettings

  // Generation context data
  generationContext: {
    selfieS3Keys: string[]
    personId?: string // Primary identifier - invited users don't have userId
    teamId?: string
    generationId?: string
    // Assets prepared in step 0 (preparation phase)
    preparedAssets?: Map<string, PreparedAsset>
    [key: string]: unknown
  }

  // Results from previous phases (if available)
  previousPhaseResults?: {
    backgroundImage?: string
    personImage?: string
    intermediateImages?: string[]
  }

  // Other elements' contributions so far (for coordination)
  existingContributions: ElementContribution[]

  /**
   * Accumulated payload from all elements processed so far
   *
   * This allows elements to coordinate with previous contributions.
   * The registry updates this field after each element contributes.
   *
   * Example: BrandingElement reading clothing data
   * ```typescript
   * const styleKey = context.accumulatedPayload?.subject?.wardrobe?.style_key
   * if (styleKey === 'business_casual') {
   *   // Place branding differently for business attire
   * }
   * ```
   *
   * Use cases:
   * - Cross-element dependencies (branding needs clothing style)
   * - Conditional logic based on previous contributions
   * - Avoiding duplicate or conflicting specifications
   *
   * Note: Only available during element contribution phase, not during preparation
   */
  accumulatedPayload?: Record<string, unknown>
}

/**
 * Validation result from element
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Abstract base class for style elements
 *
 * Elements are responsible for contributing prompt instructions
 * at specific workflow phases based on user settings.
 */
export abstract class StyleElement {
  /**
   * Unique identifier for this element
   */
  abstract readonly id: string

  /**
   * Human-readable name
   */
  abstract readonly name: string

  /**
   * Description of what this element does
   */
  abstract readonly description: string

  /**
   * Determine if this element is relevant for the given phase
   *
   * @param context - Element context with phase, settings, etc.
   * @returns true if element should contribute to this phase
   */
  abstract isRelevantForPhase(context: ElementContext): boolean

  /**
   * Contribute prompt instructions for this phase
   *
   * Only called if isRelevantForPhase returns true
   *
   * @param context - Element context with phase, settings, etc.
   * @returns Element contribution (instructions, rules, images, metadata)
   */
  abstract contribute(context: ElementContext): Promise<ElementContribution>

  /**
   * Determine if this element needs to prepare assets in step 0
   *
   * Optional - only implement if element requires asset preparation
   * (e.g., downloading images, creating collages, etc.)
   *
   * @param context - Element context with phase='preparation'
   * @returns true if element needs to prepare assets
   */
  needsPreparation?(context: ElementContext): boolean

  /**
   * Prepare assets in step 0 (preparation phase)
   *
   * Optional - only implement if needsPreparation returns true
   * This runs before any generation steps, allowing expensive operations
   * to happen in parallel without blocking prompt building
   *
   * @param context - Element context with phase='preparation'
   * @returns Prepared asset to be stored in context for later phases
   */
  prepare?(context: ElementContext): Promise<PreparedAsset>

  /**
   * Validate settings before generation
   *
   * Optional - only implement if element has validation requirements
   *
   * @param settings - User's photo style settings
   * @returns Array of error messages (empty if valid)
   */
  validate?(settings: PhotoStyleSettings): string[]

  /**
   * Priority for ordering contributions (lower = earlier)
   *
   * Default: 100
   * Lower priorities contribute first, allowing higher priorities
   * to see their contributions and potentially coordinate
   *
   * Note: Priority is used as a baseline ordering, but dependency
   * resolution (before/after/dependsOn) takes precedence
   */
  get priority(): number {
    return 100
  }

  /**
   * Element IDs this element must execute before
   *
   * Optional - specify if this element needs to contribute before others
   * Example: A base element might need to contribute before enhancement elements
   */
  get before(): string[] | undefined {
    return undefined
  }

  /**
   * Element IDs this element must execute after
   *
   * Optional - specify if this element needs to see contributions from others
   * Example: An enhancement element might need to see base contributions first
   */
  get after(): string[] | undefined {
    return undefined
  }

  /**
   * Element IDs that must be registered for this element to work
   *
   * Optional - specify hard dependencies on other elements
   * If a required element is not registered, this element will fail validation
   */
  get dependsOn(): string[] | undefined {
    return undefined
  }

  /**
   * Helper method to check if a setting exists and is not empty
   */
  protected hasValue(value: unknown): boolean {
    if (value === null || value === undefined) return false
    if (typeof value === 'string') return value.trim().length > 0
    if (Array.isArray(value)) return value.length > 0
    if (typeof value === 'object') return Object.keys(value).length > 0
    return true
  }
}
