'use client'

import { useEffect } from 'react'
import { useRouter } from '@/i18n/routing'
import { useTenant } from '@/contexts/TenantContext'

export default function TeamRouteGuard({ children }: { children: React.ReactNode }) {
  const { isIndividualDomain } = useTenant()
  const router = useRouter()

  useEffect(() => {
    if (isIndividualDomain) {
      router.replace('/app/dashboard')
    }
  }, [isIndividualDomain, router])

  if (isIndividualDomain) {
    return null
  }

  return <>{children}</>
}
