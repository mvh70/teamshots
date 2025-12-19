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
  warnings?: string[]
}

/**
 * Contribution validation result
 */
export interface ContributionValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Registry for managing and composing style elements
 */
class ElementCompositionRegistry {
  private elements = new Map<string, StyleElement>()

  /**
   * Perform topological sort on elements respecting dependencies
   *
   * @param elements - Elements to sort
   * @returns Elements in dependency-resolved order
   * @throws Error if circular dependency detected
   */
  private topologicalSort(elements: StyleElement[]): StyleElement[] {
    // Build adjacency list and in-degree map
    const graph = new Map<string, string[]>()
    const inDegree = new Map<string, number>()
    const elementMap = new Map<string, StyleElement>()

    // Initialize
    for (const element of elements) {
      graph.set(element.id, [])
      inDegree.set(element.id, 0)
      elementMap.set(element.id, element)
    }

    // Build graph from dependencies
    for (const element of elements) {
      // "before" means other elements must come after this one
      const before = element.before
      if (before) {
        for (const targetId of before) {
          if (elementMap.has(targetId)) {
            graph.get(element.id)!.push(targetId)
            inDegree.set(targetId, (inDegree.get(targetId) || 0) + 1)
          }
        }
      }

      // "after" means this element must come after others
      const after = element.after
      if (after) {
        for (const sourceId of after) {
          if (elementMap.has(sourceId)) {
            graph.get(sourceId)!.push(element.id)
            inDegree.set(element.id, (inDegree.get(element.id) || 0) + 1)
          }
        }
      }
    }

    // Kahn's algorithm for topological sort
    const queue: string[] = []
    const result: StyleElement[] = []

    // Find all nodes with in-degree 0
    for (const [id, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(id)
      }
    }

    // Sort queue by priority for deterministic ordering
    queue.sort((a, b) => {
      const elemA = elementMap.get(a)!
      const elemB = elementMap.get(b)!
      return elemA.priority - elemB.priority
    })

    while (queue.length > 0) {
      // Pop element with lowest priority among available nodes
      const currentId = queue.shift()!
      const current = elementMap.get(currentId)!
      result.push(current)

      // Reduce in-degree of neighbors
      const neighbors = graph.get(currentId)!
      for (const neighborId of neighbors) {
        const newDegree = inDegree.get(neighborId)! - 1
        inDegree.set(neighborId, newDegree)

        if (newDegree === 0) {
          queue.push(neighborId)
        }
      }

      // Keep queue sorted by priority
      queue.sort((a, b) => {
        const elemA = elementMap.get(a)!
        const elemB = elementMap.get(b)!
        return elemA.priority - elemB.priority
      })
    }

    // Check for circular dependencies
    if (result.length !== elements.length) {
      const remaining = elements.filter((e) => !result.includes(e)).map((e) => e.id)
      throw new Error(
        `Circular dependency detected among elements: ${remaining.join(', ')}`
      )
    }

    return result
  }

  /**
   * Validate element dependencies
   *
   * @param element - Element to validate
   * @returns Array of error messages
   */
  private validateDependencies(element: StyleElement): string[] {
    const errors: string[] = []

    const dependsOn = element.dependsOn
    if (dependsOn) {
      for (const requiredId of dependsOn) {
        if (!this.elements.has(requiredId)) {
          errors.push(
            `Element ${element.id} depends on ${requiredId}, but it is not registered`
          )
        }
      }
    }

    return errors
  }

  /**
   * Register a style element
   *
   * @param element - Element to register
   * @throws Error if element with same ID already registered or dependencies missing
   */
  register(element: StyleElement): void {
    if (this.elements.has(element.id)) {
      throw new Error(`Element ${element.id} already registered`)
    }

    // Validate dependencies
    const dependencyErrors = this.validateDependencies(element)
    if (dependencyErrors.length > 0) {
      console.warn(
        `[ElementComposition] Element ${element.id} has missing dependencies:`,
        dependencyErrors
      )
      // Don't throw - warn instead to allow forward references
      // Elements can be registered in any order, validation happens at runtime
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
   * @returns Array of relevant elements sorted by dependencies and priority
   * @throws Error if circular dependency detected
   */
  getRelevantElements(context: ElementContext): StyleElement[] {
    const relevantElements = Array.from(this.elements.values()).filter((element) => {
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

    // Validate all dependencies are satisfied for relevant elements
    for (const element of relevantElements) {
      const dependencyErrors = this.validateDependencies(element)
      if (dependencyErrors.length > 0) {
        throw new Error(
          `Element ${element.id} has unsatisfied dependencies: ${dependencyErrors.join(', ')}`
        )
      }
    }

    // Use topological sort to respect dependencies
    try {
      return this.topologicalSort(relevantElements)
    } catch (error) {
      console.error('[ElementComposition] Topological sort failed:', error)
      // Fallback to priority-only sorting if topological sort fails
      return relevantElements.sort((a, b) => a.priority - b.priority)
    }
  }

  /**
   * Validate an element contribution
   *
   * @param contribution - Contribution to validate
   * @param elementId - ID of element that created the contribution
   * @returns Validation result with errors and warnings
   */
  private validateContribution(
    contribution: ElementContribution,
    elementId: string
  ): ContributionValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Validate instructions
    if (contribution.instructions) {
      if (!Array.isArray(contribution.instructions)) {
        errors.push(`[${elementId}] instructions must be an array`)
      } else {
        for (let i = 0; i < contribution.instructions.length; i++) {
          const instruction = contribution.instructions[i]
          if (typeof instruction !== 'string') {
            errors.push(`[${elementId}] instruction[${i}] must be a string`)
          } else if (instruction.trim().length === 0) {
            warnings.push(`[${elementId}] instruction[${i}] is empty`)
          } else if (instruction.length > 500) {
            warnings.push(
              `[${elementId}] instruction[${i}] is very long (${instruction.length} chars)`
            )
          }
        }
      }
    }

    // Validate mustFollow rules
    if (contribution.mustFollow) {
      if (!Array.isArray(contribution.mustFollow)) {
        errors.push(`[${elementId}] mustFollow must be an array`)
      } else {
        for (let i = 0; i < contribution.mustFollow.length; i++) {
          const rule = contribution.mustFollow[i]
          if (typeof rule !== 'string') {
            errors.push(`[${elementId}] mustFollow[${i}] must be a string`)
          } else if (rule.trim().length === 0) {
            warnings.push(`[${elementId}] mustFollow[${i}] is empty`)
          }
        }
      }
    }

    // Validate freedom rules
    if (contribution.freedom) {
      if (!Array.isArray(contribution.freedom)) {
        errors.push(`[${elementId}] freedom must be an array`)
      } else {
        for (let i = 0; i < contribution.freedom.length; i++) {
          const rule = contribution.freedom[i]
          if (typeof rule !== 'string') {
            errors.push(`[${elementId}] freedom[${i}] must be a string`)
          } else if (rule.trim().length === 0) {
            warnings.push(`[${elementId}] freedom[${i}] is empty`)
          }
        }
      }
    }

    // Validate reference images
    if (contribution.referenceImages) {
      if (!Array.isArray(contribution.referenceImages)) {
        errors.push(`[${elementId}] referenceImages must be an array`)
      } else {
        for (let i = 0; i < contribution.referenceImages.length; i++) {
          const img = contribution.referenceImages[i]
          if (typeof img !== 'object' || img === null) {
            errors.push(`[${elementId}] referenceImages[${i}] must be an object`)
            continue
          }

          if (!img.url || typeof img.url !== 'string') {
            errors.push(`[${elementId}] referenceImages[${i}].url is required and must be a string`)
          } else if (img.url.trim().length === 0) {
            errors.push(`[${elementId}] referenceImages[${i}].url is empty`)
          }

          if (!img.description || typeof img.description !== 'string') {
            errors.push(
              `[${elementId}] referenceImages[${i}].description is required and must be a string`
            )
          } else if (img.description.trim().length === 0) {
            warnings.push(`[${elementId}] referenceImages[${i}].description is empty`)
          }

          if (img.type) {
            const validTypes = ['selfie', 'clothing', 'branding', 'background', 'other']
            if (!validTypes.includes(img.type)) {
              warnings.push(
                `[${elementId}] referenceImages[${i}].type "${img.type}" is not a standard type`
              )
            }
          }
        }
      }
    }

    // Validate metadata
    if (contribution.metadata) {
      if (typeof contribution.metadata !== 'object' || contribution.metadata === null) {
        errors.push(`[${elementId}] metadata must be an object`)
      } else if (Array.isArray(contribution.metadata)) {
        errors.push(`[${elementId}] metadata must be an object, not an array`)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
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

        // Validate contribution
        const validation = this.validateContribution(contribution, element.id)
        if (!validation.valid) {
          console.error(
            `[ElementComposition] Element ${element.id} produced invalid contribution:`,
            validation.errors
          )
          // Skip this contribution but continue with others
          continue
        }

        // Log warnings if any
        if (validation.warnings.length > 0) {
          console.warn(
            `[ElementComposition] Element ${element.id} contribution warnings:`,
            validation.warnings
          )
        }

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

/**
 * Helper function for element self-registration
 *
 * Use this at the bottom of element files to auto-register on import:
 * ```typescript
 * import { autoRegisterElement } from '../../composition/registry'
 * autoRegisterElement(myElement)
 * ```
 *
 * @param element - Element to register
 */
export function autoRegisterElement(element: StyleElement): void {
  // Only register in server environment
  if (typeof window === 'undefined') {
    try {
      compositionRegistry.register(element)
    } catch (error) {
      // Element might already be registered - this is OK for idempotency
      if (error instanceof Error && !error.message.includes('already registered')) {
        console.error(`[${element.id}] Auto-registration error:`, error.message)
      }
    }
  }
}
