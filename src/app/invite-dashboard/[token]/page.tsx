'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { PRICING_CONFIG } from '@/config/pricing'
import { 
  UsersIcon, 
  PhotoIcon, 
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  CameraIcon,
} from '@heroicons/react/24/outline'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { DEFAULT_PHOTO_STYLE_SETTINGS, PhotoStyleSettings as PhotoStyleSettingsType } from '@/types/photo-style'

const SelfieApproval = dynamic(() => import('@/components/Upload/SelfieApproval'), { ssr: false })
const PhotoStyleSettings = dynamic(() => import('@/components/customization/PhotoStyleSettings'), { ssr: false })

interface InviteData {
  email: string
  companyName: string
  creditsAllocated: number
  expiresAt: string
  hasActiveContext: boolean
  personId: string
  firstName: string
  lastName?: string
  contextId?: string
}

interface DashboardStats {
  photosGenerated: number
  creditsRemaining: number
  selfiesUploaded: number
  teamPhotosGenerated: number
}

interface Activity {
  id: string
  type: string
  action: string
  time: string
  status: string
  generationType?: 'personal' | 'company'
}

interface Selfie {
  id: string
  key: string
  url: string
}

export default function InviteDashboardPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [inviteData, setInviteData] = useState<InviteData | null>(null)
  const [stats, setStats] = useState<DashboardStats>({
    photosGenerated: 0,
    creditsRemaining: 0,
    selfiesUploaded: 0,
    teamPhotosGenerated: 0
  })
  const [recentActivity, setRecentActivity] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Upload flow state
  const [uploadKey, setUploadKey] = useState<string>('')
  const [isApproved, setIsApproved] = useState<boolean>(false)
  const [generationType, setGenerationType] = useState<'personal' | 'company' | null>(null)
  
  // Generation flow state
  const [showGenerationFlow, setShowGenerationFlow] = useState<boolean>(false)
  const [availableSelfies, setAvailableSelfies] = useState<Selfie[]>([])
  const [selectedSelfie, setSelectedSelfie] = useState<string>('')
  
  // Photo style settings
  const [photoStyleSettings, setPhotoStyleSettings] = useState<PhotoStyleSettingsType>(DEFAULT_PHOTO_STYLE_SETTINGS)
  const [originalContextSettings, setOriginalContextSettings] = useState<PhotoStyleSettingsType | undefined>(undefined)

  const fetchDashboardData = useCallback(async () => {
    try {
      // Fetch stats
      const statsResponse = await fetch(`/api/team/member/stats?token=${token}`)
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData.stats)
      }

      // Fetch recent activity
      const activityResponse = await fetch(`/api/team/member/activity?token=${token}`)
      if (activityResponse.ok) {
        const activityData = await activityResponse.json()
        setRecentActivity(activityData.activities)
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    }
  }, [token])

  const validateInvite = useCallback(async () => {
    try {
      const response = await fetch('/api/team/invites/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })

      const data = await response.json()

      if (response.ok) {
        setInviteData(data.invite)
        
        // Load context settings if contextId is available
        if (data.invite.contextId) {
          await loadContextSettings(data.invite.contextId)
        }
        
        // Fetch dashboard data after validating invite
        if (data.invite.personId) {
          await fetchDashboardData()
        }
      } else {
        setError(data.error)
      }
    } catch {
      setError('Failed to validate invite')
    } finally {
      setLoading(false)
    }
  }, [token, fetchDashboardData])

  const loadContextSettings = async (contextId: string) => {
    try {
      const response = await fetch(`/api/contexts/${contextId}`)
      if (response.ok) {
        const data = await response.json()
        setPhotoStyleSettings(data.context.settings)
        setOriginalContextSettings(data.context.settings)
      }
    } catch (error) {
      console.error('Error loading context settings:', error)
    }
  }

  const fetchAvailableSelfies = useCallback(async () => {
    try {
      const response = await fetch(`/api/team/member/selfies?token=${token}`)
      if (response.ok) {
        const data = await response.json()
        setAvailableSelfies(data.selfies)
      }
    } catch (error) {
      console.error('Error fetching selfies:', error)
    }
  }, [token])

  useEffect(() => {
    if (token) {
      validateInvite()
    }
  }, [token, validateInvite])

  useEffect(() => {
    if (showGenerationFlow) {
      fetchAvailableSelfies()
    }
  }, [showGenerationFlow, fetchAvailableSelfies])

  // Check if returning from selfie upload after starting generation
  useEffect(() => {
    const pendingGeneration = sessionStorage.getItem('pendingGeneration')
    if (pendingGeneration === 'true') {
      console.log('Pending generation detected, fetching selfies...')
      fetchAvailableSelfies()
    }
  }, [fetchAvailableSelfies])

  // Set up generation flow once selfies are fetched
  useEffect(() => {
    const pendingGeneration = sessionStorage.getItem('pendingGeneration')
    if (pendingGeneration === 'true' && availableSelfies.length > 0 && !uploadKey) {
      // Use the most recent selfie (first in the array)
      const latestSelfie = availableSelfies[0]
      if (latestSelfie) {
        console.log('Setting up generation flow with selfie:', latestSelfie.key)
        setUploadKey(latestSelfie.key)
        setIsApproved(true)
        setGenerationType('company')
        sessionStorage.removeItem('pendingGeneration')
      }
    }
  }, [availableSelfies, uploadKey])

  const onApprove = () => {
    setIsApproved(true)
    // For team members, automatically set to company type
    setGenerationType('company')
  }

  const onReject = async () => {
    await deleteSelfie()
  }

  const onRetake = async () => {
    await deleteSelfie()
  }

  const deleteSelfie = async () => {
    if (!uploadKey) return
    
    try {
      const response = await fetch(`/api/uploads/delete?key=${encodeURIComponent(uploadKey)}`, {
        method: 'DELETE',
      })
      
      if (response.ok) {
        setUploadKey('')
        setIsApproved(false)
      } else {
        console.error('Failed to delete selfie')
      }
    } catch (error) {
      console.error('Error deleting selfie:', error)
    }
  }

  const onProceed = async () => {
    try {
      console.log('=== DEBUG GENERATION TYPE ===')
      console.log('Raw generationType:', generationType)
      console.log('Type of generationType:', typeof generationType)
      console.log('Is array:', Array.isArray(generationType))
      console.log('Stringified:', JSON.stringify(generationType))
      
      // Ensure generationType is a string, not an array
      let finalGenerationType = Array.isArray(generationType) ? generationType[0] : generationType
      
      // Additional safeguard: ensure it's a valid string
      if (!finalGenerationType || typeof finalGenerationType !== 'string') {
        console.warn('Invalid generationType, defaulting to company:', finalGenerationType)
        finalGenerationType = 'company'
      }
      
      console.log('Final generation type:', finalGenerationType, 'Type:', typeof finalGenerationType)
      
      const requestBody = {
        selfieKey: uploadKey,
        generationType: finalGenerationType,
        creditSource: 'company', // Use company credits for team members
        contextId: inviteData?.contextId, // Pass the context ID from the invite
        // Add style settings from photo style settings
        styleSettings: photoStyleSettings,
        // Generate a prompt from the photo style settings
        prompt: generatePromptFromSettings(photoStyleSettings)
      }
      
      console.log('Request body being sent:', JSON.stringify(requestBody, null, 2))
      
      const response = await fetch('/api/generations/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      if (response.ok) {
        const result = await response.json()
        console.log('Generation started:', result)
        // Redirect to generations page to see the result
        router.push(`/invite-dashboard/${token}/generations`)
      } else {
        const error = await response.json()
        console.error('Generation failed:', error)
        alert('Failed to start generation. Please try again.')
      }
    } catch (error) {
      console.error('Error starting generation:', error)
      alert('Failed to start generation. Please try again.')
    }
  }

  const generatePromptFromSettings = (settings: PhotoStyleSettingsType) => {
    // Generate a prompt based on the photo style settings
    const promptParts = []
    
    // Add style information
    if (settings.style?.preset) {
      promptParts.push(`${settings.style.preset} style`)
    }
    
    // Add background information
    if (settings.background?.type) {
      promptParts.push(`${settings.background.type} background`)
    }
    
    // Add clothing information
    if (settings.clothing?.style) {
      promptParts.push(`${settings.clothing.style} clothing`)
    }
    
    // Add expression information
    if (settings.expression?.type) {
      promptParts.push(`${settings.expression.type} expression`)
    }
    
    // Add lighting information
    if (settings.lighting?.type) {
      promptParts.push(`${settings.lighting.type} lighting`)
    }
    
    // Default prompt if no settings are specified
    if (promptParts.length === 0) {
      return 'Professional headshot with corporate style'
    }
    
    return `Professional headshot with ${promptParts.join(', ')}`
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diffInSeconds < 60) {
      return 'Just now'
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60)
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600)
      return `${hours} hour${hours > 1 ? 's' : ''} ago`
    } else {
      const days = Math.floor(diffInSeconds / 86400)
      return `${days} day${days > 1 ? 's' : ''} ago`
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold text-gray-900 mb-2">Invalid Invite</h1>
            <p className="text-sm text-gray-600 mb-4">{error}</p>
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

  if (!inviteData) return null

  const statsConfig = [
    {
      name: 'Photos Generated',
      value: stats.photosGenerated.toString(),
      icon: PhotoIcon,
    },
    {
      name: 'Credits Remaining',
      value: stats.creditsRemaining.toString(),
      icon: ChartBarIcon,
    },
    {
      name: 'Selfies Uploaded',
      value: stats.selfiesUploaded.toString(),
      icon: CameraIcon,
    },
    {
      name: 'Team Photos',
      value: stats.teamPhotosGenerated.toString(),
      icon: UsersIcon,
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome, {inviteData.firstName}!
              </h1>
              <p className="text-sm text-gray-600">
                {inviteData.companyName} • Team Member Dashboard
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Credits</p>
              <p className="text-2xl font-bold text-brand-primary">{stats.creditsRemaining}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {statsConfig.map((stat) => (
              <div key={stat.name} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-brand-primary-light rounded-lg flex items-center justify-center">
                      <stat.icon className="h-5 w-5 text-brand-primary" />
                    </div>
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                    <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
              </div>
              <div className="p-6">
                {recentActivity.length > 0 ? (
                  <div className="space-y-4">
                    {recentActivity.map((activity) => (
                      <div key={activity.id} className="flex items-start space-x-3">
                        <div className="flex-shrink-0">
                          {activity.status === 'completed' ? (
                            <CheckCircleIcon className="h-5 w-5 text-green-500" />
                          ) : activity.status === 'processing' ? (
                            <ClockIcon className="h-5 w-5 text-blue-500" />
                          ) : (
                            <ClockIcon className="h-5 w-5 text-yellow-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900">
                            {activity.action}
                            {activity.generationType && (
                              <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                activity.generationType === 'personal' 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {activity.generationType === 'personal' ? 'Personal' : 'Team'}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500">{formatTimeAgo(activity.time)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-sm">No recent activity</p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <button 
                    onClick={() => setShowGenerationFlow(true)}
                    className="w-full flex items-center justify-center px-4 py-4 border border-brand-primary bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-colors"
                  >
                    <PhotoIcon className="h-6 w-6 mr-3" />
                    <span className="text-sm font-medium">Generate Team Photos</span>
                  </button>
                  
                  <button 
                    onClick={() => router.push(`/invite-dashboard/${token}/selfies`)}
                    className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <CameraIcon className="h-5 w-5 text-brand-primary mr-3" />
                    <span className="text-sm font-medium text-gray-900">Manage My Selfies</span>
                  </button>
                  
                  <button 
                    onClick={() => router.push(`/invite-dashboard/${token}/generations`)}
                    className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <UsersIcon className="h-5 w-5 text-brand-primary mr-3" />
                    <span className="text-sm font-medium text-gray-900">View Team Photos</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Upload Flow */}
          {uploadKey && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              {!isApproved ? (
                <SelfieApproval
                  uploadedPhotoKey={uploadKey}
                  onApprove={onApprove}
                  onReject={onReject}
                  onRetake={onRetake}
                  onCancel={() => {
                    setUploadKey('')
                    setIsApproved(false)
                  }}
                />
              ) : (
                <div className="space-y-6">
                  {/* Selfie Preview */}
                  {uploadKey && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Selected Selfie</h4>
                      <div className="relative w-full h-48 rounded-lg overflow-hidden border-2 border-gray-200 mb-6">
                        <Image
                          src={availableSelfies.find(selfie => selfie.key === uploadKey)?.url || ''}
                          alt="Selected Selfie"
                          fill
                          className="object-cover"
                        />
                      </div>
                    </div>
                  )}

                  <h3 className="text-lg font-semibold text-gray-900">Customize Your Photo</h3>
                  
                  {/* Photo Style Settings */}
                  <PhotoStyleSettings
                    value={photoStyleSettings}
                    onChange={setPhotoStyleSettings}
                    readonlyPredefined={true}
                    originalContextSettings={originalContextSettings}
                    showToggles={false}
                  />

                  {/* Generation Summary */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Generation Summary</h4>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><strong>Type:</strong> Company Use</p>
                      <p><strong>Credits:</strong> {PRICING_CONFIG.credits.perGeneration} credits</p>
                      <p><strong>Remaining:</strong> {stats.creditsRemaining} credits</p>
                    </div>
                  </div>

                  <button
                    onClick={onProceed}
                    className="w-full py-3 px-4 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 text-sm font-medium"
                  >
                    Generate Professional Photo ({PRICING_CONFIG.credits.perGeneration} credits)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Generation Flow */}
          {showGenerationFlow && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Generate Team Photos</h3>
                <button
                  onClick={() => setShowGenerationFlow(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {availableSelfies.length === 0 ? (
                <div className="text-center py-8">
                  <CameraIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">No selfies uploaded yet</h4>
                  <p className="text-sm text-gray-600 mb-4">Upload a selfie first to generate team photos.</p>
                  <button
                    onClick={() => {
                      setShowGenerationFlow(false)
                      sessionStorage.setItem('fromGeneration', 'true')
                      router.push(`/invite-dashboard/${token}/selfies`)
                    }}
                    className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 text-sm font-medium"
                  >
                    Upload Selfie
                  </button>
                </div>
              ) : (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Choose a selfie to use:</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                    {availableSelfies.map((selfie) => (
                      <div
                        key={selfie.id}
                        onClick={() => setSelectedSelfie(selfie.key)}
                        className={`relative cursor-pointer rounded-lg overflow-hidden border-2 h-32 ${
                          selectedSelfie === selfie.key 
                            ? 'border-brand-primary' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Image
                          src={selfie.url}
                          alt="Selfie"
                          fill
                          className="object-cover"
                        />
                        {selectedSelfie === selfie.key && (
                          <div className="absolute inset-0 bg-brand-primary/20 flex items-center justify-center">
                            <CheckCircleIcon className="h-6 w-6 text-brand-primary" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowGenerationFlow(false)
                        router.push(`/invite-dashboard/${token}/selfies`)
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium"
                    >
                      Upload New Selfie
                    </button>
                    <button
                      onClick={() => {
                        if (selectedSelfie) {
                          setUploadKey(selectedSelfie)
                          setIsApproved(true) // Skip validation since selfie is already approved
                          setShowGenerationFlow(false)
                        }
                      }}
                      disabled={!selectedSelfie}
                      className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      Continue with Selected Selfie
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sign up CTA */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Want to create personal photos too?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Sign up for a personal account to generate photos with full creative control.
            </p>
            <button
              onClick={() => router.push('/auth/signup')}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium"
            >
              Sign Up for Personal Use
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
