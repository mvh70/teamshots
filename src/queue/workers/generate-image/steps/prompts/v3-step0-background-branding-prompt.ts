import { getPrompt } from '@/queue/workers/generate-image/prompt-composers/getPrompt'

const STEP0_ROLE_TASK_INTRO = {
  customEdit:
    'You are a world-class brand compositor. Edit only the provided background image by integrating the provided logo naturally into the scene.',
  studioGenerate:
    'You are a world-class brand compositor. Generate a branded studio background scene and integrate the provided logo naturally according to the scene specifications.',
  environmentGenerate:
    'You are a world-class scene designer and brand compositor. Generate a branded photographic background scene and integrate the provided logo naturally according to the scene specifications.',
} as const

export function getStep0BackgroundBrandingRoleTaskIntro(params: {
  mode: 'custom-edit' | 'environment-generate'
  isStudioType?: boolean
}): string {
  if (params.mode === 'custom-edit') {
    return STEP0_ROLE_TASK_INTRO.customEdit
  }

  return params.isStudioType
    ? STEP0_ROLE_TASK_INTRO.studioGenerate
    : STEP0_ROLE_TASK_INTRO.environmentGenerate
}

export function buildStep0BackgroundBrandingPrompt(params: {
  mode: 'custom-edit' | 'environment-generate'
  isStudioType?: boolean
  jsonPrompt: Record<string, unknown>
}): string {
  return getPrompt([
    {
      lines: [
        getStep0BackgroundBrandingRoleTaskIntro({
          mode: params.mode,
          isStudioType: params.isStudioType,
        }),
      ],
    },
    {
      jsonTitle: 'Scene Specifications:',
      json: params.jsonPrompt,
    },
  ])
}
