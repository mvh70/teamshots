/**
 * Element Composition System Initialization
 *
 * Imports all elements to trigger their self-registration.
 * All elements are now consolidated in their original element folders.
 */

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
import '../beautification/element'

// Expression, pose, background, lighting
import '../expression/element'
import '../pose/element'
import '../background/element'
import '../lighting/element'
