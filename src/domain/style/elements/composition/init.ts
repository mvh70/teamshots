/**
 * Element Composition System Initialization
 *
 * DEPRECATED: Elements now self-register on import!
 *
 * This file is maintained for backward compatibility only.
 * Simply importing element modules will trigger their auto-registration.
 *
 * @deprecated - Elements self-register. Import element modules directly instead.
 */

import { compositionRegistry } from './registry'

// Import all elements to trigger their self-registration
// The order doesn't matter - elements declare dependencies and priorities
import './camera/ShotTypeElement'
import './camera/AspectRatioElement'
import './camera/CameraSettingsElement'
import './branding/BrandingElement'
import './clothing/CustomClothingElement'
import './background/BackgroundElement'
import './clothing/ClothingElement'
import './clothing/ClothingColorsElement'
import './subject/ExpressionElement'
import './subject/PoseElement'
import './subject/SubjectElement'
import './lighting/LightingElement'

/**
 * Initialize the element composition system by importing all elements
 *
 * DEPRECATED: This function is now a no-op. Elements self-register on import.
 * Kept for backward compatibility.
 *
 * @deprecated - Use direct element imports instead
 */
export function initializeElementComposition(): void {
  // Elements have already self-registered via import-time side effects
  console.log(
    `[ElementComposition] ${compositionRegistry.count} elements registered via auto-registration:`,
    compositionRegistry.getAll().map((e) => `${e.id} (priority: ${e.priority})`)
  )
}

// Call for backward compatibility
initializeElementComposition()
