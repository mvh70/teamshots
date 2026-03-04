import { useRouter } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { MIN_SELFIES_REQUIRED } from '@/constants/generation'

export interface InviteFlowNavigation {
  toDashboard: () => void
  replaceDashboard: () => void
  toSelfieTips: () => void
  toSelfies: () => void
  replaceSelfies: () => void
  toBeautification: () => void
  replaceCustomization: () => void
  toCustomizationIntro: () => void
  toCustomization: () => void
  toGenerations: () => void
  startFlow: (selectedIds: string[]) => void
}

export function useInviteFlowNavigation(token: string): InviteFlowNavigation {
  const router = useRouter()

  const toDashboard = useCallback(() => {
    router.push(`/invite-dashboard/${token}`)
  }, [router, token])

  const replaceDashboard = useCallback(() => {
    router.replace(`/invite-dashboard/${token}`)
  }, [router, token])

  const toSelfieTips = useCallback(() => {
    router.push(`/invite-dashboard/${token}/selfie-tips`)
  }, [router, token])

  const toSelfies = useCallback(() => {
    router.push(`/invite-dashboard/${token}/selfies`)
  }, [router, token])

  const replaceSelfies = useCallback(() => {
    router.replace(`/invite-dashboard/${token}/selfies`)
  }, [router, token])

  const toBeautification = useCallback(() => {
    router.push(`/invite-dashboard/${token}/beautification`)
  }, [router, token])

  const replaceCustomization = useCallback(() => {
    router.replace(`/invite-dashboard/${token}/customization`)
  }, [router, token])

  const toCustomizationIntro = useCallback(() => {
    router.push(`/invite-dashboard/${token}/customization-intro`)
  }, [router, token])

  const toCustomization = useCallback(() => {
    router.push(`/invite-dashboard/${token}/customization`)
  }, [router, token])

  const toGenerations = useCallback(() => {
    router.push(`/invite-dashboard/${token}/generations`)
  }, [router, token])

  const startFlow = useCallback((selectedIds: string[]) => {
    if (selectedIds.length >= MIN_SELFIES_REQUIRED) {
      router.push(`/invite-dashboard/${token}/beautification`)
      return
    }
    router.push(`/invite-dashboard/${token}/selfie-tips`)
  }, [router, token])

  return useMemo(
    () => ({
      toDashboard,
      replaceDashboard,
      toSelfieTips,
      toSelfies,
      replaceSelfies,
      toBeautification,
      replaceCustomization,
      toCustomizationIntro,
      toCustomization,
      toGenerations,
      startFlow,
    }),
    [
      toDashboard,
      replaceDashboard,
      toSelfieTips,
      toSelfies,
      replaceSelfies,
      toBeautification,
      replaceCustomization,
      toCustomizationIntro,
      toCustomization,
      toGenerations,
      startFlow,
    ]
  )
}
