'use client'

import React from 'react'

interface CameraPermissionErrorProps {
  /** Callback when user clicks "Try again" */
  onRetry: () => void
}

/**
 * Component that displays a friendly error message when camera access is denied,
 * with instructions on how to enable it and a retry button.
 */
export default function CameraPermissionError({ onRetry }: CameraPermissionErrorProps) {
  return (
    <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl" data-testid="camera-permission-error">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
          <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-amber-800 mb-1">Camera access needed</h4>
          <p className="text-sm text-amber-700 mb-3">
            To take a selfie, please allow camera access in your browser settings.
          </p>
          <div className="text-xs text-amber-600 space-y-1.5">
            <p className="font-medium">How to enable:</p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>Look for the camera icon in your browser&apos;s address bar</li>
              <li>Click it and select &quot;Allow&quot;</li>
              <li>Then refresh this page or try again</li>
            </ul>
          </div>
          <button
            onClick={onRetry}
            className="mt-3 text-sm font-medium text-amber-700 hover:text-amber-800 underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  )
}

