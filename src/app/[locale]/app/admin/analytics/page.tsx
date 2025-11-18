'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from '@/i18n/routing'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface AnalyticsData {
  totalUsers: number
  paidUsers: number
  conversionRate: number
  arpu: number
  onboardingCompletionRate: number
  lastUpdated: string
  personalTimeToFirstGen?: number
  teamTimeToFirstInvite?: number
  teamTimeToFirstGen?: number
}

export default function AdminAnalyticsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'loading') return

    // Check if user is admin
    if (!session?.user?.role?.includes('admin')) {
      router.push('/app/dashboard')
      return
    }

    // Fetch analytics data
    const fetchAnalytics = async () => {
      try {
        const response = await fetch('/api/admin/analytics')
        if (response.ok) {
          const data = await response.json()
          setAnalytics(data)
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [session, status, router])

  if (status === 'loading' || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  if (!session?.user?.role?.includes('admin')) {
    return null // Will redirect
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
        <p className="text-gray-600 mt-2">Key metrics for TeamShots performance</p>
        {analytics?.lastUpdated && (
          <p className="text-sm text-gray-500 mt-1">
            Last updated: {new Date(analytics.lastUpdated).toLocaleString()}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {analytics?.totalUsers?.toLocaleString() || '—'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Paid Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {analytics?.paidUsers?.toLocaleString() || '—'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Install-to-Paid Conversion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {analytics?.conversionRate ? `${(analytics.conversionRate * 100).toFixed(1)}%` : '—'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">ARPU</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {analytics?.arpu ? `$${analytics.arpu.toFixed(2)}` : '—'}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Onboarding Completion</CardTitle>
            <CardDescription>Percentage of users who complete the onboarding flow</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900 mb-2">
              {analytics?.onboardingCompletionRate ? `${(analytics.onboardingCompletionRate * 100).toFixed(1)}%` : '—'}
            </div>
            <Badge variant="outline">Tracked via PostHog funnel</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Key Insights</CardTitle>
            <CardDescription>Focus areas for improvement</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Conversion Rate Target</span>
              <Badge variant={analytics?.conversionRate && analytics.conversionRate > 0.05 ? "default" : "secondary"}>
                {analytics?.conversionRate && analytics.conversionRate > 0.05 ? "✓ On track" : "⚠️ Needs attention"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">ARPU Target ($50+)</span>
              <Badge variant={analytics?.arpu && analytics.arpu > 50 ? "default" : "secondary"}>
                {analytics?.arpu && analytics.arpu > 50 ? "✓ On track" : "⚠️ Needs attention"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Onboarding Completion (80%+)</span>
              <Badge variant={analytics?.onboardingCompletionRate && analytics.onboardingCompletionRate > 0.8 ? "default" : "secondary"}>
                {analytics?.onboardingCompletionRate && analytics.onboardingCompletionRate > 0.8 ? "✓ On track" : "⚠️ Needs attention"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">

        <Card>

          <CardHeader>

            <CardTitle>Avg Time to First Personal Gen</CardTitle>

            <CardDescription>Minutes from registration to first generation for personal users</CardDescription>

          </CardHeader>

          <CardContent>

            <div className="text-3xl font-bold text-gray-900 mb-2">

              {analytics?.personalTimeToFirstGen ? `${analytics.personalTimeToFirstGen} min` : '—'}

            </div>

            <Badge variant={analytics?.personalTimeToFirstGen && analytics.personalTimeToFirstGen < 30 ? "default" : "secondary"}>

              {analytics?.personalTimeToFirstGen && analytics.personalTimeToFirstGen < 30 ? "✓ Fast" : "⚠️ Slow"}

            </Badge>

          </CardContent>

        </Card>

        <Card>

          <CardHeader>

            <CardTitle>Avg Time to First Team Invite</CardTitle>

            <CardDescription>Minutes from registration to first invite for team admins</CardDescription>

          </CardHeader>

          <CardContent>

            <div className="text-3xl font-bold text-gray-900 mb-2">

              {analytics?.teamTimeToFirstInvite ? `${analytics.teamTimeToFirstInvite} min` : '—'}

            </div>

            <Badge variant={analytics?.teamTimeToFirstInvite && analytics.teamTimeToFirstInvite < 30 ? "default" : "secondary"}>

              {analytics?.teamTimeToFirstInvite && analytics.teamTimeToFirstInvite < 30 ? "✓ Fast" : "⚠️ Slow"}

            </Badge>

          </CardContent>

        </Card>

        <Card>

          <CardHeader>

            <CardTitle>Avg Time to First Team Gen</CardTitle>

            <CardDescription>Minutes from registration to first generation for team admins</CardDescription>

          </CardHeader>

          <CardContent>

            <div className="text-3xl font-bold text-gray-900 mb-2">

              {analytics?.teamTimeToFirstGen ? `${analytics.teamTimeToFirstGen} min` : '—'}

            </div>

            <Badge variant={analytics?.teamTimeToFirstGen && analytics.teamTimeToFirstGen < 30 ? "default" : "secondary"}>

              {analytics?.teamTimeToFirstGen && analytics.teamTimeToFirstGen < 30 ? "✓ Fast" : "⚠️ Slow"}

            </Badge>

          </CardContent>

        </Card>

      </div>

    </div>
  )
}
