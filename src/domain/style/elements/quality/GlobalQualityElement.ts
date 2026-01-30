import { StyleElement, ElementContext, ElementContribution } from '../base/StyleElement'

export class GlobalQualityElement extends StyleElement {
    readonly id = 'global-quality'
    readonly name = 'Global Quality Assurance'
    readonly description = 'Enforces baseline quality standards and safety checks for all generations.'

    // Run LAST to ensure it appends to everything else and isn't overwritten
    get priority(): number {
        return 100
    }

    isRelevantForPhase(context: ElementContext): boolean {
        // This element should run for every generation to ensure safety and quality
        return true
    }

    async contribute(context: ElementContext): Promise<ElementContribution> {
        // Quality rules are now handled by the hardcoded Technical Requirements in step1a
        // to avoid bloating the prompt with redundant instructions.
        // This element only provides payload metadata for rendering configuration.

        return {
            // No mustFollow rules - these are handled in step1a Technical Requirements
            mustFollow: [],

            // Structured data for backend/model config only
            payload: {
                rendering: {
                    quality_tier: "standard_v1",
                    safety_mode: "strict",
                    style_mode: "raw"
                }
            }
        }
    }
}

// Auto-register instance
export const globalQualityElement = new GlobalQualityElement()

// Auto-register
import { autoRegisterElement } from '../composition/registry'
autoRegisterElement(globalQualityElement)
