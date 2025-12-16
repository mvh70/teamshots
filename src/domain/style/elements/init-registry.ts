/**
 * Initialize Element Registry
 *
 * This file imports all element configs and registers them.
 * Import this file early in the application lifecycle to ensure
 * all elements are registered before they're used.
 */

import { registerElement } from './registry'
import { backgroundElementConfig } from './background/config'
import { brandingElementConfig } from './branding/config'
import { clothingElementConfig } from './clothing/config'
import { clothingColorsElementConfig } from './clothing-colors/config'
import { customClothingElementConfig } from './custom-clothing/config'
import { expressionElementConfig } from './expression/config'
import { lightingElementConfig } from './lighting/config'
import { poseElementConfig } from './pose/config'
import { shotTypeElementConfig } from './shot-type/config'

// Register all elements
registerElement('background', backgroundElementConfig)
registerElement('branding', brandingElementConfig)
registerElement('clothing', clothingElementConfig)
registerElement('clothingColors', clothingColorsElementConfig)
registerElement('customClothing', customClothingElementConfig)
registerElement('expression', expressionElementConfig)
registerElement('lighting', lightingElementConfig)
registerElement('pose', poseElementConfig)
registerElement('shotType', shotTypeElementConfig)

// Note: 'style' element is not included as it appears to be deprecated/unused
