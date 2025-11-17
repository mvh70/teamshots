'use client'

interface SelfieUploadSuccessProps {
  className?: string
}

export default function SelfieUploadSuccess({ className = '' }: SelfieUploadSuccessProps) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`} data-testid="upload-success">
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-brand-secondary-lighter mb-4">
          <svg className="h-6 w-6 text-brand-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2" data-testid="success-title">Selfie Approved!</h3>
        <p className="text-sm text-gray-600" data-testid="success-message">Your selfie has been saved successfully.</p>
      </div>
    </div>
  )
}

