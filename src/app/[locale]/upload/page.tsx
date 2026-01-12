'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { PRICING_CONFIG } from '@/config/pricing'
import { jsonFetcher } from '@/lib/fetcher'

const PhotoUpload = dynamic(() => import('@/components/Upload/PhotoUpload'), { ssr: false })
const SelfieApproval = dynamic(() => import('@/components/Upload/SelfieApproval'), { ssr: false })
const GenerationTypeSelector = dynamic(() => import('@/components/GenerationTypeSelector'), { ssr: false })

interface PersonData {
  id: string
  firstName: string
  lastName?: string
  email: string
  teamId: string
  creditsAllocated: number
}

export default function UploadPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const personId = searchParams.get('personId')
  const token = searchParams.get('token')

  // Compute person data and validation state during render
  const { personData, error } = useMemo(() => {
    if (personId && token) {
      // In a real app, you'd fetch person data from the API
      // For now, we'll use the data from the invite acceptance
      return {
        personData: {
          id: personId,
          firstName: 'Team Member', // This would come from the API
          email: 'team@team.com',
          teamId: 'team-id',
          creditsAllocated: 5
        } as PersonData,
        error: null
      }
    }
    return { personData: null, error: 'Invalid access' }
  }, [personId, token])

  const [key, setKey] = useState<string>('')
  const [isApproved, setIsApproved] = useState<boolean>(false)
  const [generationType, setGenerationType] = useState<'personal' | 'team' | null>(null)
  // Loading is false since we compute data synchronously (mock data)
  // In a real app with API fetch, you'd use a data fetching library
  const loading = false

  const onPhotoUploaded = (result: { key: string; url?: string } | { key: string; url?: string }[]) => {
    const key = Array.isArray(result) ? result[0]?.key : result.key;
    if (key) {
      setKey(key);
    }
  }

  const onApprove = () => {
    setIsApproved(true)
  }

  const onRetake = async () => {
    await deleteSelfie()
  }

  const onCancel = async () => {
    await deleteSelfie()
  }

  const deleteSelfie = async () => {
    if (!key) return
    
    try {
      await jsonFetcher(`/api/uploads/delete?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      })
      
      setKey('')
      setIsApproved(false)
    } catch (error) {
      console.error('Error deleting selfie:', error)
      // You might want to show a toast notification here
    }
  }

  const onTypeSelected = (type: 'personal' | 'team') => {
    setGenerationType(type)
  }

  const onProceed = () => {
    // TODO: call generation API with { key, generationType, personId, token }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (error || !personData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-sm text-gray-600 mb-4">{error || 'Invalid access'}</p>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
            >
              Go to Homepage
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Credits for team member
  // NEW CREDIT MODEL: All usable credits are on person
  const userCredits = {
    individual: 0, // Team members don't have individual credits
    team: 0, // Team pool is not used for generation
    person: personData.creditsAllocated // This is what they can use
  }

  const hasTeamAccess = true // Team members always have team access
  const teamName = 'Your Team' // This would come from the API

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome, {personData.firstName}!
          </h1>
          <p className="text-gray-600">
            Upload your photo to generate professional headshots
          </p>
        </div>

        <div className="space-y-6">
          {!key ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Upload Your Photo</h2>
              <p className="text-sm text-gray-600 mb-4">
                Upload a clear photo of yourself to get started.
              </p>
              <div className="max-w-md mx-auto">
                <PhotoUpload onUploaded={onPhotoUploaded} />
              </div>
            </div>
          ) : !isApproved ? (
        <SelfieApproval
          photoKey={key}
          onApprove={onApprove}
          onRetake={onRetake}
          onCancel={onCancel}
        />
          ) : !generationType ? (
            <GenerationTypeSelector
              photoKey={key}
              onTypeSelected={onTypeSelected}
              userCredits={userCredits}
              hasTeamAccess={hasTeamAccess}
              teamName={teamName}
            />
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Ready to Generate
              </h2>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Photo uploaded</p>
                    <p className="text-xs text-gray-500 font-mono">{key}</p>
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Generation Details</h3>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><strong>Type:</strong> {generationType === 'personal' ? 'Personal Use' : 'Team Use'}</p>
                    <p><strong>Credits:</strong> {PRICING_CONFIG.credits.perGeneration} credits</p>
                    <p><strong>Remaining:</strong> {userCredits.person} credits</p>
                  </div>
                </div>

                <button
                  onClick={onProceed}
                  className="w-full py-2 px-4 bg-brand-primary text-white rounded-md hover:bg-brand-primary-hover text-sm font-medium"
                >
                  Generate Professional Photo ({PRICING_CONFIG.credits.perGeneration} credits)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sign up CTA for personal use */}
        {generationType === 'team' && (
          <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Want to create personal photos too?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Sign up for a personal account to generate photos with full creative control.
            </p>
            <button
              onClick={() => window.location.href = 'https://www.photoshotspro.com'}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium"
            >
              Sign Up for Personal Use
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
