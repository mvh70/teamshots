/**
 * Element Composition System Initialization
 *
 * Registers all style elements with the composition registry.
 * Import this file to initialize the element system.
 */

import { compositionRegistry } from './registry'
import { shotTypeElement } from './camera/ShotTypeElement'
import { brandingElement } from './branding/BrandingElement'
import { customClothingElement } from './clothing/CustomClothingElement'

/**
 * Initialize the element composition system by registering all elements
 *
 * This function is idempotent - safe to call multiple times
 */
export function initializeElementComposition(): void {
  // Register camera elements
  compositionRegistry.register(shotTypeElement)

  // Register branding elements
  compositionRegistry.register(brandingElement)

  // Register clothing elements
  compositionRegistry.register(customClothingElement)

  console.log(
    `[ElementComposition] Initialized with ${compositionRegistry.count} elements:`,
    compositionRegistry.getAll().map((e) => e.id)
  )
}

/**
 * Auto-initialize on module load
 * Elements are registered when this module is imported
 */
initializeElementComposition()
