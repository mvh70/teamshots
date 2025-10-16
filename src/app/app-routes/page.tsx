'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function AppRoutesPage() {
  const router = useRouter()

  useEffect(() => {
    router.push('/app-routes/dashboard')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500"></div>
    </div>
  )
}