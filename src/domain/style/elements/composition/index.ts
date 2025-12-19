/**
 * Element Composition System
 *
 * Exports for the element-level prompt composition system
 *
 * To use the element composition system:
 * 1. Import and call initializeElementComposition() (done automatically on import)
 * 2. Use compositionRegistry.composeContributions() in workflow steps
 */

export { compositionRegistry, registerElements } from './registry'
export type { ValidationResult } from './registry'
export {
  StyleElement,
  type WorkflowPhase,
  type ReferenceImage,
  type ElementContribution,
  type ElementContext,
  type PreparedAsset,
} from '../base/StyleElement'
export { initializeElementComposition } from './init'

// Auto-initialize elements on module load
import './init'
