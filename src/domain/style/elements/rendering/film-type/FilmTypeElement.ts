import { StyleElement, ElementContext, ElementContribution } from '../../base/StyleElement'
import { FILM_TYPE_CONFIG } from './types'
import { autoRegisterElement } from '../../composition/registry'

export class FilmTypeElement extends StyleElement {
    readonly id = 'filmType'
    readonly name = 'Film Type'
    readonly description = 'Simulates specific film stocks and camera profiles'

    isRelevantForPhase(context: ElementContext): boolean {
        // Only relevant for person generation and scene composition phases where styling applies
        return context.phase === 'person-generation' || context.phase === 'composition'
    }

    async contribute(context: ElementContext): Promise<ElementContribution> {
        const settings = context.settings

        // Check if filmType is explicitly set in settings
        if (settings.filmType?.mode === 'predefined' && settings.filmType.value) {
            const type = settings.filmType.value.type
            const config = FILM_TYPE_CONFIG[type]

            if (config) {
                return {
                    payload: {
                        rendering: {
                            film_type: config.fullString
                        }
                    },
                    metadata: {
                        filmType: type,
                        description: config.description
                    }
                }
            }
        }

        // Check if it's set via custom prompt or fallback
        // Note: If no setting is present, we do nothing. Packages can set a default by modifying settings before calling composition.
        return {}
    }
}

// Auto-register the element
autoRegisterElement(new FilmTypeElement())
