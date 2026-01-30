/**
 * Element Composition System Initialization
 *
 * Imports all elements to trigger their self-registration.
 * All elements are now consolidated in their original element folders.
 */

import { compositionRegistry } from './registry'

// Import all elements from their primary locations
// These auto-register on import

// Camera elements
import '../camera-settings/element'
import '../shot-type/element'
import '../aspect-ratio/element'

// Clothing elements
import '../clothing/element'
import '../clothing/overlay-element'
import '../clothing-colors/element'
import '../custom-clothing/element'

// Branding
import '../branding/element'

// Subject
import '../subject/element'

// Expression, pose, background, lighting
import '../expression/element'
import '../pose/element'
import '../background/element'
import '../lighting/element'

/**
 * Initialize the element composition system
 * @deprecated - Elements self-register on import
 */
export function initializeElementComposition(): void {
  console.log(
    `[ElementComposition] ${compositionRegistry.count} elements registered:`,
    compositionRegistry.getAll().map((e) => `${e.id} (priority: ${e.priority})`)
  )
}

initializeElementComposition()
