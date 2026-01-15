'use client'

import { useEffect, useState } from 'react'
import { useRouter } from '@/i18n/routing'
import { fetchAccountMode } from '@/domain/account/accountMode'

export default function GenerationsPage() {
  const router = useRouter()
  const [accountMode, setAccountMode] = useState<string | null>(null)

  useEffect(() => {
    const redirect = async () => {
      // Fetch account mode to determine correct redirect
      const accountModeResult = await fetchAccountMode()
      setAccountMode(accountModeResult.mode)

      // Redirect based on account mode:
      // - Pro users go to team generations
      // - Individual users go to personal generations
      if (accountModeResult.mode === 'pro') {
        router.replace('/app/generations/team')
      } else {
        router.replace('/app/generations/personal')
      }
    }

    redirect()
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto mb-4"></div>
        <p className="text-gray-600">
          {accountMode === 'pro' ? 'Redirecting to Team Generations...' : 'Redirecting to Personal Generations...'}
        </p>
      </div>
    </div>
  )
}


