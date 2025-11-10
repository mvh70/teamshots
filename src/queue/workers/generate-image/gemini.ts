import { readFile as fsReadFile } from 'node:fs/promises'

import { VertexAI } from '@google-cloud/vertexai'
import type { Content, GenerateContentResult, Part, GenerativeModel } from '@google-cloud/vertexai'

import { Logger } from '@/lib/logger'
import { Env } from '@/lib/env'

export interface GeminiReferenceImage {
  mimeType: string
  base64: string
  description?: string
}

const MODEL_CACHE = new Map<string, GenerativeModel>()
let cachedProjectId: string | null = null

function normalizeModelName(modelName: string): string {
  const trimmed = modelName.trim()
  const lower = trimmed.toLowerCase()

  const aliasMap: Record<string, string> = {
    'gemini-flash-2.0': 'gemini-2.0-flash',
    'gemini-flash-2.0-latest': 'gemini-2.0-flash',
    'gemini-flash-2.5': 'gemini-2.5-flash',
    'gemini-flash-2.5-latest': 'gemini-2.5-flash',
    'gemini-pro-1.5': 'gemini-1.5-pro',
    'gemini-pro-1.5-latest': 'gemini-1.5-pro'
  }

  if (aliasMap[lower]) {
    return aliasMap[lower]
  }

  const swappedPattern = /^gemini-(flash|pro)-(\d+(?:\.\d+)?)(.*)$/
  const swappedMatch = lower.match(swappedPattern)
  if (swappedMatch) {
    const [, family, version, suffix] = swappedMatch
    const normalized = `gemini-${version}-${family}${suffix}`
    return normalized
  }

  return trimmed
}

async function resolveProjectId(): Promise<string> {
  if (cachedProjectId) {
    return cachedProjectId
  }

  let projectId = Env.string('GOOGLE_PROJECT_ID', '')
  if (!projectId) {
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
    if (credentialsPath) {
      try {
        const credentialsContent = await fsReadFile(credentialsPath, 'utf-8')
        const credentials = JSON.parse(credentialsContent) as { project_id?: string }
        if (credentials.project_id) {
          projectId = credentials.project_id
          Logger.debug('Extracted project ID from service account credentials', {
            projectId,
            credentialsPath
          })
        }
      } catch (error) {
        Logger.warn('Failed to read project ID from service account credentials', {
          credentialsPath,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }
  }

  if (!projectId) {
    throw new Error(
      'GOOGLE_PROJECT_ID is not set in environment and could not be extracted from GOOGLE_APPLICATION_CREDENTIALS. Please set GOOGLE_PROJECT_ID in your .env file or deployment environment variables.'
    )
  }

  cachedProjectId = projectId
  return projectId
}

export async function getVertexGenerativeModel(modelName: string): Promise<GenerativeModel> {
  const normalizedModelName = normalizeModelName(modelName)

  if (normalizedModelName !== modelName) {
    Logger.warn('Normalized Gemini model name for Vertex AI request', {
      originalModelName: modelName,
      normalizedModelName
    })
  }

  const cached = MODEL_CACHE.get(normalizedModelName)
  if (cached) {
    return cached
  }

  const projectId = await resolveProjectId()
  const location = Env.string('GOOGLE_LOCATION', 'us-central1')
  const vertexAI = new VertexAI({ project: projectId, location })
  const model = vertexAI.getGenerativeModel({ model: normalizedModelName })

  MODEL_CACHE.set(normalizedModelName, model)
  Logger.debug('Initialized Vertex AI model', { modelName: normalizedModelName, location })
  return model
}

export async function generateWithGemini(
  prompt: string,
  images: GeminiReferenceImage[],
  aspectRatio?: string
): Promise<Buffer[]> {
  const modelName = Env.string('GEMINI_IMAGE_MODEL', 'gemini-2.5-flash')
  const model = await getVertexGenerativeModel(modelName)

  const parts: Part[] = [{ text: prompt }]
  for (const image of images) {
    if (image.description) {
      parts.push({ text: image.description })
    }
    parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } })
  }

  const contents: Content[] = [
    {
      role: 'user',
      parts
    }
  ]

  void aspectRatio

  const response: GenerateContentResult = await model.generateContent({ contents })

  const responseParts = response.response.candidates?.[0]?.content?.parts ?? []
  const generatedImages: Buffer[] = []
  for (const part of responseParts) {
    if (part.inlineData?.data) {
      generatedImages.push(Buffer.from(part.inlineData.data, 'base64'))
    }
  }

  return generatedImages
}

