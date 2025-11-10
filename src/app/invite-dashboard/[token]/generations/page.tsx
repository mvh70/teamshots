'use client'

import { useParams, useRouter } from 'next/navigation'
import { PhotoIcon } from '@heroicons/react/24/outline'
import InviteDashboardHeader from '@/components/invite/InviteDashboardHeader'
import GenerationCard from '@/app/[locale]/app/generations/components/GenerationCard'
import { useInvitedGenerations } from './useInvitedGenerations'

export default function GenerationsPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string
  const { generations, loading, error } = useInvitedGenerations(token)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading generations...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <InviteDashboardHeader showBackToDashboard token={token} title="" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          {generations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {generations.map((generation) => (
                <GenerationCard
                  key={generation.id}
                  item={generation}
                  token={token}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="text-center py-12">
                <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No generations yet</h3>
                <p className="mt-1 text-sm text-gray-500">Upload a selfie and generate your first team photos.</p>
                <div className="mt-6">
                  <button
                    onClick={() => router.push(`/invite-dashboard/${token}`)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-brand-primary hover:bg-brand-primary-hover"
                  >
                    Upload Selfie
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
