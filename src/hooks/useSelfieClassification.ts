'use client'

import { useState, useCallback } from 'react'
import type { SelfieType, ClassificationResult } from '@/domain/selfie/selfie-types'

interface ClassificationState {
  isClassifying: boolean
  result: ClassificationResult | null
  error: string | null
}

interface UseSelfieClassificationReturn extends ClassificationState {
  classify: (imageFile: File) => Promise<ClassificationResult | null>
  reset: () => void
}

/**
 * Hook for real-time selfie type classification.
 *
 * Converts a File to base64 and calls the classification API
 * to determine the selfie type (front_view, side_view, full_body).
 *
 * @example
 * ```tsx
 * const { isClassifying, result, classify, reset } = useSelfieClassification()
 *
 * const handleCapture = async (file: File) => {
 *   const classification = await classify(file)
 *   if (classification) {
 *     console.log('Detected:', classification.selfieType)
 *   }
 * }
 * ```
 */
export function useSelfieClassification(): UseSelfieClassificationReturn {
  const [state, setState] = useState<ClassificationState>({
    isClassifying: false,
    result: null,
    error: null,
  })

  const classify = useCallback(
    async (imageFile: File): Promise<ClassificationResult | null> => {
      setState((prev) => ({ ...prev, isClassifying: true, error: null }))

      try {
        const base64 = await fileToBase64(imageFile)

        const response = await fetch('/api/selfies/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType: imageFile.type,
          }),
          credentials: 'include',
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Classification failed: ${errorText}`)
        }

        const result: ClassificationResult = await response.json()
        setState({ isClassifying: false, result, error: null })
        return result
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Classification failed'
        setState((prev) => ({
          ...prev,
          isClassifying: false,
          error: errorMsg,
        }))
        return null
      }
    },
    []
  )

  const reset = useCallback(() => {
    setState({ isClassifying: false, result: null, error: null })
  }, [])

  return { ...state, classify, reset }
}

/**
 * Convert a File to base64 string (without data URL prefix)
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }
    reader.readAsDataURL(file)
  })
}

export type { ClassificationState, UseSelfieClassificationReturn }
