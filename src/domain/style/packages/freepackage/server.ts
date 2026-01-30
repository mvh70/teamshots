import { freepackage as freepackageBase } from './index'
import type { GenerationContext, GenerationPayload } from '@/types/generation'
import { BasePackageServer } from '../../base/BasePackageServer'

export type FreePackageServerPackage = typeof freepackageBase & {
  buildGenerationPayload: (context: GenerationContext) => Promise<GenerationPayload>
}

const serverInstance = new BasePackageServer(freepackageBase)

export const freepackageServer: FreePackageServerPackage = {
  ...freepackageBase,
  buildGenerationPayload: (context: GenerationContext) => serverInstance.buildGenerationPayload(context)
}
