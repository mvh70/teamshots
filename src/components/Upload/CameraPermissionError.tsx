'use client'

import React from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { X, Camera } from 'lucide-react'

interface CameraPermissionErrorProps {
  /** Callback when user clicks "Try again" */
  onRetry: () => void
  /** Callback when user dismisses the modal */
  onDismiss?: () => void
}

/**
 * Component that displays a friendly error message when camera access is denied,
 * with instructions on how to enable it and a retry button.
 * 
 * Shows as a modal overlay centered on screen.
 */
export default function CameraPermissionError({ 
  onRetry, 
  onDismiss
}: CameraPermissionErrorProps) {
  // Don't render on server
  if (typeof document === 'undefined' || !document.body) return null

  const modal = (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      data-testid="camera-permission-error-modal"
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/60 to-black/70 backdrop-blur-md animate-in fade-in duration-200"
        onClick={onDismiss}
        aria-hidden="true"
      />
      
      {/* Modal content - responsive design */}
      <div className="relative bg-white rounded-3xl shadow-2xl shadow-black/25 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-300 border border-gray-200/60">
        {/* Close button */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="absolute top-6 right-6 z-10 p-2.5 rounded-full bg-white/90 hover:bg-gray-50 transition-all shadow-md hover:shadow-lg hover:scale-110 active:scale-95 backdrop-blur-sm border border-gray-200/50"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-600 hover:text-gray-800 transition-colors" />
          </button>
        )}

        <div className="p-7 sm:p-9">
          {/* Icon and title */}
          <div className="flex flex-col items-center text-center mb-7">
            <div className="relative flex-shrink-0 w-24 h-24 bg-gradient-to-br from-brand-primary via-brand-primary-hover to-brand-primary rounded-3xl flex items-center justify-center mb-5 shadow-2xl shadow-brand-primary/35 transform transition-all hover:scale-105 hover:shadow-2xl hover:shadow-brand-primary/45 animate-in zoom-in-95 duration-300">
              <Camera className="w-11 h-11 text-white" strokeWidth={2.5} />
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/25 via-white/10 to-transparent pointer-events-none" />
              <div className="absolute -inset-3 rounded-3xl bg-brand-primary/30 blur-2xl opacity-70 animate-pulse" />
              <div className="absolute inset-0 rounded-3xl ring-2 ring-white/20 pointer-events-none" />
            </div>
            <h4 className="text-2xl sm:text-3xl font-display font-bold text-text-dark mb-2.5 tracking-tight animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100">
              Camera Access Needed
            </h4>
            <p className="text-sm sm:text-base text-text-muted max-w-sm leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200 font-sans">
              We need permission to use your camera to take photos
            </p>
          </div>

          {/* Instructions */}
          <div className="bg-gradient-to-br from-brand-primary-light via-brand-primary-light/95 to-brand-primary-lighter border-2 border-brand-primary-lighter/90 rounded-2xl p-6 mb-6 shadow-lg shadow-brand-primary/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-brand-primary/10 rounded-full -mr-24 -mt-24 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-36 h-36 bg-brand-primary/6 rounded-full -ml-18 -mb-18 blur-2xl" />
            <div className="relative">
              <p className="text-xs font-bold text-brand-primary mb-4 uppercase tracking-widest flex items-center gap-2.5 font-sans">
                <span className="w-2 h-2 rounded-full bg-brand-primary shadow-md shadow-brand-primary/60 animate-pulse" />
                To enable camera access
              </p>
              <ol className="text-sm sm:text-base text-text-body space-y-3.5 ml-6 list-decimal marker:font-bold marker:text-brand-primary marker:text-lg marker:leading-relaxed font-sans">
                <li className="leading-relaxed pl-2.5">Tap the <span className="font-semibold text-text-dark">lock or settings icon</span> in your browser&apos;s address bar</li>
                <li className="leading-relaxed pl-2.5">Find <span className="font-semibold text-text-dark">Camera</span> and toggle it to <span className="font-semibold text-text-dark">Allow</span></li>
                <li className="leading-relaxed pl-2.5">Tap <span className="font-semibold text-text-dark">&quot;Try again&quot;</span> below</li>
              </ol>
            </div>
          </div>

          {/* Screenshot hint */}
          <div className="flex items-center justify-center mb-7 animate-in fade-in zoom-in-95 duration-500 delay-300">
            <div className="relative w-full max-w-[240px] rounded-2xl overflow-hidden border-2 border-brand-primary-lighter/90 shadow-xl ring-4 ring-brand-primary-lighter/25 bg-white p-2 transition-all hover:scale-[1.03] hover:shadow-2xl hover:ring-brand-primary-lighter/40">
              <div className="rounded-xl overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100/50">
                <Image
                  src="/images/camera_permissions.png"
                  alt="Camera permission settings in browser"
                  width={240}
                  height={240}
                  className="w-full h-auto"
                  unoptimized
                />
              </div>
              <div className="absolute -top-2 -right-2 w-5 h-5 bg-brand-primary rounded-full ring-3 ring-white shadow-xl animate-pulse" />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={onRetry}
              className="group w-full px-6 py-3.5 text-base font-semibold rounded-xl bg-gradient-to-r from-brand-primary via-brand-primary to-brand-primary-hover text-white hover:from-brand-primary-hover hover:to-brand-primary transition-all shadow-lg shadow-brand-primary/25 hover:shadow-xl hover:shadow-brand-primary/40 hover:scale-[1.02] active:scale-[0.98] ring-2 ring-brand-primary/20 hover:ring-brand-primary/50 relative overflow-hidden font-sans"
            >
              <span className="relative z-10 flex items-center justify-center gap-2.5">
                <Camera className="w-4 h-4 transition-transform group-hover:scale-110" strokeWidth={2.5} />
                Try again
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            </button>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="w-full px-5 py-2.5 text-sm font-medium text-text-muted hover:text-text-body transition-all rounded-lg hover:bg-gray-50/90 active:scale-[0.98] border border-transparent hover:border-gray-200/60 font-sans"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
