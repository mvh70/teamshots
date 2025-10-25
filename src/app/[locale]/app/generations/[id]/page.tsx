'use client'

import { useEffect, useState } from 'react'
import { Link } from '@/i18n/routing'
import Image from 'next/image'

type GenDetail = {
  id: string
  uploadedKey: string
  acceptedKey?: string
  status: string
  createdAt: string
  contextName?: string
  costCredits: number
}

export default function GenerationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string>('')
  
  useEffect(() => {
    params.then(({ id: paramId }) => setId(paramId))
  }, [params])
  const [data, setData] = useState<GenDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/generations/list?scope=me&limit=1&cursor=${encodeURIComponent(id)}`)
        if (res.ok) {
          const json = await res.json()
          // This is a placeholder; ideally add a dedicated /api/generations/:id
          const item = (json.items || []).find((x: GenDetail) => x.id === id) || null
          setData(item)
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) return <div className="text-gray-600">Loading…</div>
  if (!data) return <div className="text-gray-600">Not found</div>

  const imageKey = data.acceptedKey || data.uploadedKey

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Generation</h1>
        <Link href="/app/generations" className="text-sm text-gray-700 hover:text-gray-900">Back</Link>
      </div>
      <div className="bg-white border rounded-lg p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="bg-gray-50 rounded overflow-hidden">
            <Image src={`/api/files/get?key=${encodeURIComponent(imageKey)}`} alt="generated" width={500} height={500} className="w-full h-auto" />
          </div>
          <div className="space-y-3">
            <div className="text-sm text-gray-600">Status: <span className="font-medium text-gray-900">{data.status}</span></div>
            <div className="text-sm text-gray-600">Created: <span className="font-medium text-gray-900">{new Date(data.createdAt).toLocaleString()}</span></div>
            <div className="text-sm text-gray-600">Context: <span className="font-medium text-gray-900">{data.contextName || 'Default'}</span></div>
            <div className="text-sm text-gray-600">Credits: <span className="font-medium text-gray-900">{data.costCredits}</span></div>
            <div className="pt-2 flex gap-2">
              <a href={`/api/files/get?key=${encodeURIComponent(imageKey)}`} className="px-3 py-2 rounded-md border text-sm">Download</a>
              <Link href={`/app/generate/start?key=${encodeURIComponent(data.uploadedKey)}`} className="px-3 py-2 rounded-md border text-sm">Regenerate</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


