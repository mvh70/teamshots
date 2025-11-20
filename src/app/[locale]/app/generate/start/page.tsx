import { Suspense } from 'react'
import { getGenerationPageData } from './actions'
import StartGenerationClient from './StartGenerationClient'

export default async function StartGenerationPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedParams = await searchParams
  const keyFromQuery = typeof resolvedParams.key === 'string' ? resolvedParams.key : undefined
  
  // Fetch all data server-side - eliminates all useEffect hooks
  const pageData = await getGenerationPageData(keyFromQuery)
  
  return (
    <Suspense fallback={<LoadingState />}>
      <StartGenerationClient 
        initialData={pageData}
        keyFromQuery={keyFromQuery}
      />
    </Suspense>
  )
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    </div>
  )
}
