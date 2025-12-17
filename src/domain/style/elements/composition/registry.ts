/**
 * Element Composition Registry and Engine
 *
 * Central registry for all style elements with composition logic
 * to combine contributions from multiple elements at each workflow phase.
 *
 * Note: This is separate from the existing elements/registry.ts which handles
 * UI configuration. This registry manages prompt composition elements.
 */

import {
  StyleElement,
  ElementContext,
  ElementContribution,
  ReferenceImage,
} from '../base/StyleElement'
import type { PhotoStyleSettings } from '@/types/photo-style'

/**
 * Validation result for all elements
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Registry for managing and composing style elements
 */
class ElementCompositionRegistry {
  private elements = new Map<string, StyleElement>()

  /**
   * Register a style element
   *
   * @param element - Element to register
   * @throws Error if element with same ID already registered
   */
  register(element: StyleElement): void {
    if (this.elements.has(element.id)) {
      throw new Error(`Element ${element.id} already registered`)
    }
    this.elements.set(element.id, element)
    console.log(`[ElementComposition] Registered element: ${element.id} (${element.name})`)
  }

  /**
   * Get element by ID
   *
   * @param id - Element ID
   * @returns Element or undefined if not found
   */
  get(id: string): StyleElement | undefined {
    return this.elements.get(id)
  }

  /**
   * Get all registered elements
   *
   * @returns Array of all elements
   */
  getAll(): StyleElement[] {
    return Array.from(this.elements.values())
  }

  /**
   * Get elements relevant for a specific phase
   *
   * @param context - Element context with phase, settings, etc.
   * @returns Array of relevant elements sorted by priority
   */
  getRelevantElements(context: ElementContext): StyleElement[] {
    return Array.from(this.elements.values())
      .filter((element) => {
        try {
          return element.isRelevantForPhase(context)
        } catch (error) {
          console.error(
            `[ElementComposition] Error checking relevance for ${element.id}:`,
            error
          )
          return false
        }
      })
      .sort((a, b) => a.priority - b.priority)
  }

  /**
   * Compose prompt contributions from all relevant elements for a given phase
   *
   * This is the core composition engine that:
   * 1. Finds all elements relevant to the phase
   * 2. Sorts them by priority
   * 3. Calls each element's contribute() method
   * 4. Merges all contributions into a single result
   *
   * @param context - Element context with phase, settings, etc.
   * @returns Composed contribution from all relevant elements
   */
  async composeContributions(context: ElementContext): Promise<ElementContribution> {
    const relevantElements = this.getRelevantElements(context)

    console.log(
      `[ElementComposition] Composing contributions for phase: ${context.phase}`,
      `(${relevantElements.length} relevant elements)`
    )

    const allInstructions: string[] = []
    const allMustFollow: string[] = []
    const allFreedom: string[] = []
    const allReferenceImages: ReferenceImage[] = []
    const allMetadata: Record<string, unknown> = {}

    for (const element of relevantElements) {
      try {
        const contribution = await element.contribute(context)

        if (contribution.instructions?.length) {
          allInstructions.push(...contribution.instructions)
        }

        if (contribution.mustFollow?.length) {
          allMustFollow.push(...contribution.mustFollow)
        }

        if (contribution.freedom?.length) {
          allFreedom.push(...contribution.freedom)
        }

        if (contribution.referenceImages?.length) {
          allReferenceImages.push(...contribution.referenceImages)
        }

        if (contribution.metadata && Object.keys(contribution.metadata).length > 0) {
          // Namespace metadata by element ID to avoid conflicts
          allMetadata[element.id] = contribution.metadata
        }

        // Update context with cumulative contributions for next element
        context.existingContributions.push(contribution)

        console.log(
          `[ElementComposition] ${element.id} contributed:`,
          `${contribution.instructions?.length || 0} instructions,`,
          `${contribution.mustFollow?.length || 0} rules,`,
          `${contribution.referenceImages?.length || 0} images`
        )
      } catch (error) {
        console.error(
          `[ElementComposition] Element ${element.id} failed to contribute:`,
          error
        )
        // Continue with other elements - one failure shouldn't break the whole system
      }
    }

    return {
      instructions: allInstructions.length > 0 ? allInstructions : undefined,
      mustFollow: allMustFollow.length > 0 ? allMustFollow : undefined,
      freedom: allFreedom.length > 0 ? allFreedom : undefined,
      referenceImages: allReferenceImages.length > 0 ? allReferenceImages : undefined,
      metadata: Object.keys(allMetadata).length > 0 ? allMetadata : undefined,
    }
  }

  /**
   * Validate all element settings before generation
   *
   * @param settings - User's photo style settings
   * @returns Validation result with any errors
   */
  validateSettings(settings: PhotoStyleSettings): ValidationResult {
    const errors: string[] = []

    for (const element of this.elements.values()) {
      if (element.validate) {
        try {
          const elementErrors = element.validate(settings)
          if (elementErrors.length > 0) {
            errors.push(...elementErrors.map((err) => `[${element.id}] ${err}`))
          }
        } catch (error) {
          console.error(`[ElementComposition] Validation error in ${element.id}:`, error)
          errors.push(`[${element.id}] Validation failed: ${error}`)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Clear all registered elements (mainly for testing)
   */
  clear(): void {
    this.elements.clear()
  }

  /**
   * Get count of registered elements
   */
  get count(): number {
    return this.elements.size
  }
}

/**
 * Global element composition registry instance
 *
 * Elements are registered at module load time
 */
export const compositionRegistry = new ElementCompositionRegistry()

/**
 * Helper function to register multiple elements at once
 */
export function registerElements(elements: StyleElement[]): void {
  for (const element of elements) {
    compositionRegistry.register(element)
  }
}
