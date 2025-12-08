import type { GenerationContext, GenerationPayload } from '@/types/generation'
import { headshot1Server } from './headshot1/server'
import { outfit1Server } from './outfit1/server'
import { freepackageServer } from './freepackage/server'
import type { ClientStylePackage } from './index'
import { isFeatureEnabled } from '@/config/feature-flags'

export type ServerStylePackage = ClientStylePackage & {
  buildGenerationPayload: (context: GenerationContext) => Promise<GenerationPayload>
}

// Build SERVER_PACKAGES dynamically based on feature flags
function buildServerPackages(): Record<string, ServerStylePackage> {
  const packages: Record<string, ServerStylePackage> = {
    [headshot1Server.id]: headshot1Server,
    [freepackageServer.id]: freepackageServer
  }

  // Add outfit1 only if feature flag is enabled
  if (isFeatureEnabled('outfitTransfer')) {
    packages[outfit1Server.id] = outfit1Server
  }

  return packages
}

export const SERVER_PACKAGES = buildServerPackages()

export const getServerPackageConfig = (id?: string): ServerStylePackage => {
  if (!id) return headshot1Server
  return SERVER_PACKAGES[id] || headshot1Server
}

