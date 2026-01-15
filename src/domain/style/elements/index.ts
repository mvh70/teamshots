/**
 * Element Registry Loader
 *
 * This file imports all element metadata to register them in the global registry.
 * Import this file early in the app to ensure all elements are available.
 */

// Import metadata files to trigger registration
import './background/metadata'
import './branding/metadata'
import './pose/metadata'
import './clothing/metadata'
import './clothing-colors/metadata'
import './custom-clothing/metadata'
import './expression/metadata'
import './industry/metadata'
import './lighting/metadata'
import './shot-type/metadata'

// Re-export the registry utilities
export {
  getElementMetadata,
  getAllElements,
  getElements,
  ELEMENT_REGISTRY
} from './metadata'
export type { ElementMetadata } from './metadata'
