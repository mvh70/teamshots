export type FilmType =
    | 'clinical-modern'
    | 'cinematic-drama'
    | 'portra-warm'
    | 'kodak-editorial'
    | 'fuji-documentary'

export interface FilmTypeValue {
    type: FilmType
}

export interface FilmTypeSettings {
    mode: 'predefined' | 'user-choice'
    value?: FilmTypeValue
}

export const FILM_TYPE_CONFIG: Record<FilmType, { id: string; label: string; description: string; fullString: string }> = {
    'clinical-modern': {
        id: 'clinical-modern',
        label: 'Clinical Modern',
        description: 'Ultra-sharp, clean digital look',
        fullString: 'clinical-modern (Phase One IQ4)'
    },
    'cinematic-drama': {
        id: 'cinematic-drama',
        label: 'Cinematic Drama',
        description: 'Rich contrast and color grading',
        fullString: 'cinematic-drama (RED Komodo 6K)'
    },
    'portra-warm': {
        id: 'portra-warm',
        label: 'Portra Warm',
        description: 'Natural, warm skin tones',
        fullString: 'portra-warm (Kodak Portra 800)'
    },
    'kodak-editorial': {
        id: 'kodak-editorial',
        label: 'Kodak Editorial',
        description: 'Vibrant, fashion-forward colors',
        fullString: 'kodak-editorial (Kodak Ektar 100)'
    },
    'fuji-documentary': {
        id: 'fuji-documentary',
        label: 'Fuji Documentary',
        description: 'Soft shadows and natural look',
        fullString: 'fuji-documentary (Fujifilm Pro 400H)'
    }
}
