'use client'

import { DEFAULT_CUSTOMIZATION_STEPS_META } from '@/lib/customizationSteps'
import { useEnsureInviteCustomizationMeta } from './useEnsureInviteCustomizationMeta'
import { useGenerationFlowState, type UseGenerationFlowStateOptions } from './useGenerationFlowState'

interface UseInviteGenerationFlowStateOptions
  extends Omit<UseGenerationFlowStateOptions, 'beautificationScope'> {
  token: string
}

export function useInviteGenerationFlowState({
  token,
  ...options
}: UseInviteGenerationFlowStateOptions) {
  const flowState = useGenerationFlowState({
    ...options,
    beautificationScope: `invite_${token}`,
    flowScope: token,
  })

  const currentMeta = flowState.customizationStepsMeta ?? DEFAULT_CUSTOMIZATION_STEPS_META

  useEnsureInviteCustomizationMeta({
    token,
    currentMeta,
    setCustomizationStepsMeta: flowState.setCustomizationStepsMeta,
  })

  return flowState
}
