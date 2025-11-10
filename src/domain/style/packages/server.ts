import type { GenerationContext, GenerationPayload } from '@/types/generation'
import { headshot1Server } from './headshot1/server'
import { freepackageServer } from './freepackage/server'
import type { ClientStylePackage } from './index'

export type ServerStylePackage = ClientStylePackage & {
  buildGenerationPayload: (context: GenerationContext) => Promise<GenerationPayload>
}

export const SERVER_PACKAGES: Record<string, ServerStylePackage> = {
  [headshot1Server.id]: headshot1Server,
  [freepackageServer.id]: freepackageServer
}

export const getServerPackageConfig = (id?: string): ServerStylePackage => {
  if (!id) return headshot1Server
  return SERVER_PACKAGES[id] || headshot1Server
}

