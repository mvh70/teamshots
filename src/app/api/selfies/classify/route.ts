import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { classifySelfieType } from '@/domain/selfie/selfie-classifier'
import { Logger } from '@/lib/logger'

export const runtime = 'nodejs'

/**
 * POST /api/selfies/classify
 *
 * Classify a selfie image using AI vision to determine its type
 * (front_view, side_view, full_body, or unknown).
 *
 * Request body:
 * - imageBase64: string - Base64 encoded image data
 * - mimeType: string - Image MIME type (e.g., 'image/jpeg')
 *
 * Response:
 * - selfieType: 'front_view' | 'side_view' | 'full_body' | 'unknown'
 * - confidence: number (0.0 - 1.0)
 * - reasoning?: string - Optional explanation from the AI
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { imageBase64, mimeType } = body as {
      imageBase64?: string
      mimeType?: string
    }

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid imageBase64' },
        { status: 400 }
      )
    }

    if (!mimeType || typeof mimeType !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid mimeType' },
        { status: 400 }
      )
    }

    // Validate MIME type is an image
    if (!mimeType.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Invalid mimeType: must be an image type' },
        { status: 400 }
      )
    }

    const result = await classifySelfieType({ imageBase64, mimeType })

    return NextResponse.json(result)
  } catch (error) {
    Logger.error('Selfie classification endpoint error', {
      error: error instanceof Error ? error.message : String(error),
    })

    // Return a graceful fallback instead of error
    return NextResponse.json({
      selfieType: 'unknown',
      confidence: 0,
      reasoning: 'Classification service temporarily unavailable',
      personCount: 0,
      isProper: false,
      improperReason: 'Classification service temporarily unavailable',
    })
  }
}
