'use client'

/**
 * Example component showing how to use Google Analytics tracking
 * This is just for reference - you can delete this file or adapt it to your needs
 */

import { trackEvent, trackSignup, trackConversion } from '@/lib/analytics'
import { useState } from 'react'

export default function AnalyticsExample() {
  const [status, setStatus] = useState<string>('')

  const handleButtonClick = () => {
    // Track a simple button click
    trackEvent('example_button_click', {
      button_location: 'analytics_example_page',
      timestamp: new Date().toISOString()
    })
    setStatus('✅ Button click tracked!')
    setTimeout(() => setStatus(''), 3000)
  }

  const handleSignup = () => {
    // Track user signup
    trackSignup('email')
    setStatus('✅ Signup tracked!')
    setTimeout(() => setStatus(''), 3000)
  }

  const handlePurchase = () => {
    // Track a conversion/purchase
    trackConversion('test_transaction_123', 29.99, 'USD')
    setStatus('✅ Purchase tracked!')
    setTimeout(() => setStatus(''), 3000)
  }

  const handleCustomEvent = () => {
    // Track a custom event with multiple parameters
    trackEvent('photo_generation', {
      style: 'professional',
      background: 'office',
      credits_used: 4,
      generation_time_ms: 3500,
      success: true
    })
    setStatus('✅ Custom event tracked!')
    setTimeout(() => setStatus(''), 3000)
  }

  return (
    <div className="max-w-2xl mx-auto p-8 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-4">Google Analytics Examples</h1>
      <p className="text-gray-600 mb-6">
        Click the buttons below to trigger analytics events. Open your browser's
        DevTools console to see the events being sent.
      </p>

      {status && (
        <div className="mb-4 p-3 bg-green-100 text-green-800 rounded">
          {status}
        </div>
      )}

      <div className="space-y-3">
        <button
          onClick={handleButtonClick}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          Track Button Click
        </button>

        <button
          onClick={handleSignup}
          className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
        >
          Track Signup Event
        </button>

        <button
          onClick={handlePurchase}
          className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition"
        >
          Track Purchase/Conversion
        </button>

        <button
          onClick={handleCustomEvent}
          className="w-full px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition"
        >
          Track Custom Event (Photo Generation)
        </button>
      </div>

      <div className="mt-6 p-4 bg-gray-100 rounded text-sm">
        <h3 className="font-semibold mb-2">Testing Tips:</h3>
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          <li>Open DevTools Console (F12) to see events</li>
          <li>Type <code className="bg-gray-200 px-1">dataLayer</code> in console to see all events</li>
          <li>Check Google Analytics Real-time reports</li>
          <li>Use Google Tag Assistant extension</li>
        </ul>
      </div>
    </div>
  )
}
