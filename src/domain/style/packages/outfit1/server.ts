import { outfit1 as outfit1Base } from './index'
import type { GenerationContext, GenerationPayload } from '@/types/generation'
import { BasePackageServer } from '../../base/BasePackageServer'

export type Outfit1ServerPackage = typeof outfit1Base & {
  buildGenerationPayload: (context: GenerationContext) => Promise<GenerationPayload>
}

const serverInstance = new BasePackageServer(outfit1Base)

export const outfit1Server: Outfit1ServerPackage = {
  ...outfit1Base,
  buildGenerationPayload: (context: GenerationContext) => serverInstance.buildGenerationPayload(context)
}
