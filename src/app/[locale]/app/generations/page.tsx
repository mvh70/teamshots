'use client'

import { useEffect } from 'react'
import { useRouter } from '@/i18n/routing'

export default function GenerationsPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to personal generations page
    router.replace('/app/generations/personal')
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to Personal Generations...</p>
      </div>
    </div>
  )
}


