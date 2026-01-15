'use client'

import { useEffect, useState } from 'react'
import { Link } from '@/i18n/routing'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { formatDate } from '@/lib/format'
import { jsonFetcher } from '@/lib/fetcher'
import { Grid } from '@/components/ui'

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
  const t = useTranslations('generations')
  const [id, setId] = useState<string>('')
  
  // Extract params from promise - intentional async pattern for Next.js App Router
  /* eslint-disable react-you-might-not-need-an-effect/no-pass-live-state-to-parent */
  useEffect(() => {
    params.then(({ id: paramId }) => setId(paramId))
  }, [params])
  /* eslint-enable react-you-might-not-need-an-effect/no-pass-live-state-to-parent */
  const [data, setData] = useState<GenDetail | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch generation data when ID changes
  /* eslint-disable react-you-might-not-need-an-effect/no-chain-state-updates */
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const json = await jsonFetcher<{ items?: GenDetail[] }>(`/api/generations/list?scope=me&limit=1&cursor=${encodeURIComponent(id)}`)
        // This is a placeholder; ideally add a dedicated /api/generations/:id
        const item = (json.items || []).find((x: GenDetail) => x.id === id) || null
        setData(item)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])
  /* eslint-enable react-you-might-not-need-an-effect/no-chain-state-updates */

  if (loading) return <div className="text-gray-600">{t('detail.loading')}</div>
  if (!data) return <div className="text-gray-600">{t('detail.notFound')}</div>

  const imageKey = data.acceptedKey || data.uploadedKey

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t('detail.title')}</h1>
        <Link href="/app/generations" className="text-sm text-gray-700 hover:text-gray-900">{t('detail.back')}</Link>
      </div>
      <div className="bg-white border rounded-lg p-4">
        <Grid cols={{ mobile: 1, desktop: 2 }} gap="lg" className="items-start">
          <div className="bg-gray-50 rounded overflow-hidden">
            <Image src={`/api/files/get?key=${encodeURIComponent(imageKey)}`} alt="generated" width={500} height={500} className="w-full h-auto" unoptimized />
          </div>
          <div className="space-y-3">
            <div className="text-sm text-gray-600">{t('detail.status')} <span className="font-medium text-gray-900">{data.status}</span></div>
            <div className="text-sm text-gray-600">{t('detail.created')} <span className="font-medium text-gray-900">{formatDate(data.createdAt)}</span></div>
            <div className="text-sm text-gray-600">{t('detail.context')} <span className="font-medium text-gray-900">{data.contextName || 'Default'}</span></div>
            <div className="text-sm text-gray-600">{t('detail.credits')} <span className="font-medium text-gray-900">{data.costCredits}</span></div>
            <div className="pt-2 flex gap-2">
              <a href={`/api/files/get?key=${encodeURIComponent(imageKey)}`} className="px-3 py-2 rounded-md border text-sm">{t('actions.download')}</a>
              <Link href={`/app/generate/start?key=${encodeURIComponent(data.uploadedKey)}`} className="px-3 py-2 rounded-md border text-sm">{t('actions.regenerate')}</Link>
            </div>
          </div>
        </Grid>
      </div>
    </div>
  )
}


