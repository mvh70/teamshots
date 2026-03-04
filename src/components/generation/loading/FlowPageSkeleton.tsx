'use client'

interface FlowPageSkeletonProps {
  variant?: 'content' | 'grid' | 'centered-spinner'
  loadingLabel?: string
}

export default function FlowPageSkeleton({
  variant = 'content',
  loadingLabel = 'Loading...',
}: FlowPageSkeletonProps) {
  if (variant === 'centered-spinner') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto" />
          <p className="mt-2 text-sm text-gray-600">{loadingLabel}</p>
        </div>
      </div>
    )
  }

  if (variant === 'grid') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="px-4 py-6">
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="aspect-square bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
      </div>
      <div className="px-4 py-8 space-y-6">
        <div className="h-8 w-3/4 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-5/6 bg-gray-200 rounded animate-pulse" />
        <div className="mt-8 space-y-4">
          <div className="h-24 bg-gray-200 rounded-xl animate-pulse" />
          <div className="h-24 bg-gray-200 rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  )
}
