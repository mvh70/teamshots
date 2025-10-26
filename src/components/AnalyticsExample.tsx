'use client'

import { useAnalytics } from '@/hooks/useAnalytics'

export function AnalyticsExample() {
  const { track } = useAnalytics()

  const handleButtonClick = () => {
    track('example_button_clicked', {
      timestamp: new Date().toISOString(),
      user_agent: navigator.userAgent,
    })
  }

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Analytics Example</h3>
      <p className="text-sm text-gray-600 mb-4">
        Click the button below to test PostHog analytics tracking.
      </p>
      <button
        onClick={handleButtonClick}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Track Button Click
      </button>
    </div>
  )
}
