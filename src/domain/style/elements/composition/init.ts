/**
 * Element Composition System Initialization
 *
 * Registers all style elements with the composition registry.
 * Import this file to initialize the element system.
 */

import { compositionRegistry } from './registry'
import { shotTypeElement } from './camera/ShotTypeElement'
import { aspectRatioElement } from './camera/AspectRatioElement'
import { cameraSettingsElement } from './camera/CameraSettingsElement'
import { brandingElement } from './branding/BrandingElement'
import { customClothingElement } from './clothing/CustomClothingElement'
import { backgroundElement } from './background/BackgroundElement'
import { clothingElement } from './clothing/ClothingElement'
import { clothingColorsElement } from './clothing/ClothingColorsElement'
import { expressionElement } from './subject/ExpressionElement'
import { poseElement } from './subject/PoseElement'
import { subjectElement } from './subject/SubjectElement'
import { lightingElement } from './lighting/LightingElement'

/**
 * Initialize the element composition system by registering all elements
 *
 * This function is idempotent - safe to call multiple times
 */
export function initializeElementComposition(): void {
  // Register subject elements (highest priority)
  compositionRegistry.register(subjectElement)        // Priority 10 - identity is critical
  compositionRegistry.register(aspectRatioElement)    // Priority 20 - canvas dimensions
  compositionRegistry.register(lightingElement)       // Priority 25 - lighting setup
  compositionRegistry.register(cameraSettingsElement) // Priority 30 - camera technical specs
  compositionRegistry.register(poseElement)           // Priority 35 - fundamental positioning
  compositionRegistry.register(shotTypeElement)       // Priority 40 - framing
  compositionRegistry.register(expressionElement)     // Priority 45 - facial expression

  // Register clothing elements
  compositionRegistry.register(clothingElement)       // Priority 50 - clothing style
  compositionRegistry.register(customClothingElement) // Priority 50 - custom outfits
  compositionRegistry.register(clothingColorsElement) // Priority 55 - color specifications

  // Register branding elements
  compositionRegistry.register(brandingElement)       // Priority 60 - logo placement

  // Register background elements
  compositionRegistry.register(backgroundElement)     // Priority 70 - scene setting

  console.log(
    `[ElementComposition] Initialized with ${compositionRegistry.count} elements:`,
    compositionRegistry.getAll().map((e) => `${e.id} (priority: ${e.priority})`)
  )
}

/**
 * Auto-initialize on module load
 * Elements are registered when this module is imported
 */
initializeElementComposition()
