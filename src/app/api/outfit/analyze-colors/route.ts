/**
 * Outfit Color Analysis Endpoint
 *
 * Uses Gemini 2.5 Flash to extract dominant colors and description from outfit images.
 * Implements security measures and cost tracking.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { Telemetry } from '@/lib/telemetry'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rate-limit'
import { RATE_LIMITS } from '@/config/rate-limit-config'
import { SecurityLogger } from '@/lib/security-logger'
import { CostTrackingService } from '@/domain/services/CostTrackingService'
import { z } from 'zod'

export const runtime = 'nodejs'

// Request validation
const analyzeColorsSchema = z.object({
  imageData: z.string(), // Base64 encoded image
  mimeType: z.string().regex(/^image\/(png|jpeg|webp|heic)$/),
})

// Response type
interface OutfitColors {
  topBase: string // Hex color
  topCover?: string // Hex color (optional for layers like blazer)
  bottom: string // Hex color
  shoes?: string // Hex color (optional)
}

interface ColorAnalysisResponse {
  colors: OutfitColors
  description: string // Natural language description
}

export async function POST(req: NextRequest) {
  const startTime = Date.now()

  try {
    // 1. Rate limiting
    const identifier = await getRateLimitIdentifier(req, 'outfit_analysis')
    const rateLimit = await checkRateLimit(
      identifier,
      RATE_LIMITS.outfitAnalysis.limit,
      RATE_LIMITS.outfitAnalysis.window
    )

    if (!rateLimit.success) {
      await SecurityLogger.logRateLimitExceeded(identifier)
      Telemetry.increment('outfit.analysis.rate_limited')

      return NextResponse.json(
        { error: 'Too many analysis requests. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil((rateLimit.reset - Date.now()) / 1000)) }
        }
      )
    }

    // 2. Authenticate
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 3. Get person for cost tracking
    const person = await prisma.person.findUnique({
      where: { userId: session.user.id },
      select: { id: true, teamId: true }
    })

    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    }

    // 4. Parse and validate request
    const body = await req.json()
    const validated = analyzeColorsSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validated.error.issues },
        { status: 400 }
      )
    }

    const { imageData, mimeType } = validated.data

    // 5. Validate base64 size (prevent DoS)
    const maxBase64Size = 15 * 1024 * 1024 // ~15MB base64 = ~11MB image
    if (imageData.length > maxBase64Size) {
      return NextResponse.json(
        { error: 'Image data too large', code: 'IMAGE_TOO_LARGE' },
        { status: 400 }
      )
    }

    // 6. Call Gemini for color analysis (using generation system infrastructure)
    const analysisResult = await analyzeOutfitColors(imageData, mimeType)

    if (!analysisResult.success) {
      Telemetry.increment('outfit.analysis.gemini_error')

      // Track failed cost
      await CostTrackingService.trackCall({
        generationId: undefined,
        personId: person.id,
        teamId: person.teamId ?? undefined,
        provider: 'vertex',
        model: 'gemini-2.5-flash',
        inputTokens: 0,
        outputTokens: 0,
        reason: 'outfit_color_analysis',
        result: 'failure',
        errorMessage: analysisResult.error,
        durationMs: Date.now() - startTime
      })

      return NextResponse.json(
        {
          error: analysisResult.error || 'Color analysis failed',
          code: analysisResult.code || 'ANALYSIS_ERROR'
        },
        { status: 500 }
      )
    }

    // 7. Track successful cost
    await CostTrackingService.trackCall({
      generationId: undefined,
      personId: person.id,
      teamId: person.teamId ?? undefined,
      provider: 'vertex',
      model: 'gemini-2.5-flash',
      inputTokens: analysisResult.usage?.inputTokens || 0,
      outputTokens: analysisResult.usage?.outputTokens || 0,
      reason: 'outfit_color_analysis',
      result: 'success',
      durationMs: Date.now() - startTime,
      metadata: {
        endpoint: 'analyze-colors',
        colorsDetected: Object.keys(analysisResult.data.colors).length
      }
    })

    // 8. Log success
    const duration = Date.now() - startTime
    Logger.info('Outfit color analysis completed', {
      personId: person.id,
      colorsDetected: Object.keys(analysisResult.data.colors).length,
      durationMs: duration
    })

    Telemetry.increment('outfit.analysis.success')
    Telemetry.timing('outfit.analysis.duration', duration)

    return NextResponse.json(analysisResult.data)

  } catch (error) {
    Logger.error('Outfit color analysis failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    Telemetry.increment('outfit.analysis.error')

    return NextResponse.json(
      {
        error: 'Analysis failed',
        code: 'ANALYSIS_ERROR',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

/**
 * Analyze outfit colors using Gemini (reuses generation infrastructure)
 */
async function analyzeOutfitColors(
  imageData: string,
  mimeType: string
): Promise<
  | { success: true; data: ColorAnalysisResponse; usage?: { inputTokens: number; outputTokens: number } }
  | { success: false; error: string; code?: string }
> {
  try {
    // Use the same Gemini utilities as generation system
    const { getVertexGenerativeModel } = await import('@/queue/workers/generate-image/gemini')

    const model = await getVertexGenerativeModel('gemini-2.5-flash')

    const prompt = `Analyze this outfit image and extract the dominant colors and description.

Return a JSON object with this EXACT structure:
{
  "colors": {
    "topBase": "#HEXCODE",
    "topCover": "#HEXCODE",
    "bottom": "#HEXCODE",
    "shoes": "#HEXCODE"
  },
  "description": "Brief description of the outfit"
}

Rules:
1. "topBase" is the base shirt/top color (REQUIRED)
2. "topCover" is the jacket/blazer/cardigan color if present (optional)
3. "bottom" is the pants/skirt/shorts color (REQUIRED)
4. "shoes" is the shoe color if visible (optional)
5. Use 6-digit hex codes (e.g., #1F2937, not #000)
6. Description should be 1-2 sentences describing style and colors
7. If this is NOT a clothing/outfit image, set all colors to "#000000" and description to "Invalid: not an outfit image"

Example valid response:
{
  "colors": {
    "topBase": "#F3F4F6",
    "topCover": "#1F2937",
    "bottom": "#111827",
    "shoes": "#8B5A2B"
  },
  "description": "Light gray dress shirt under a charcoal blazer with dark navy trousers and brown leather shoes."
}`

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageData.replace(/^data:image\/[a-z]+;base64,/, '') // Strip prefix if present
            }
          },
          { text: prompt }
        ]
      }]
    })

    const response = result.response
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text

    if (!text) {
      return { success: false, error: 'No response from Gemini', code: 'NO_RESPONSE' }
    }

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      Logger.warn('Gemini returned non-JSON response', { text })
      return { success: false, error: 'Invalid response format', code: 'INVALID_RESPONSE' }
    }

    const parsed = JSON.parse(jsonMatch[0]) as ColorAnalysisResponse

    // Validate response structure
    if (!parsed.colors || !parsed.description) {
      return { success: false, error: 'Invalid response structure', code: 'INVALID_STRUCTURE' }
    }

    // Check for invalid outfit detection
    if (parsed.description.toLowerCase().includes('invalid:')) {
      return {
        success: false,
        error: 'Image does not appear to contain clothing',
        code: 'NOT_CLOTHING'
      }
    }

    // Extract usage metadata
    const usage = {
      inputTokens: response.usageMetadata?.promptTokenCount || 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount || 0
    }

    return { success: true, data: parsed, usage }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    Logger.error('Gemini color analysis failed', {
      error: errorMessage,
      stack: errorStack,
      errorType: error?.constructor?.name,
      fullError: JSON.stringify(error, null, 2)
    })

    if (error instanceof Error) {
      if (error.message.includes('RATE_LIMIT')) {
        return { success: false, error: 'Rate limit exceeded', code: 'RATE_LIMIT' }
      }
      if (error.message.includes('SAFETY')) {
        return { success: false, error: 'Content policy violation', code: 'SAFETY' }
      }
    }

    return { success: false, error: errorMessage || 'Analysis failed', code: 'GEMINI_ERROR' }
  }
}
