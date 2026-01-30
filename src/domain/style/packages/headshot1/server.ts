import { headshot1 as headshot1Base } from './index'
import type { GenerationContext, GenerationPayload } from '@/types/generation'
import { BasePackageServer } from '../../base/BasePackageServer'

export type Headshot1ServerPackage = typeof headshot1Base & {
  buildGenerationPayload: (context: GenerationContext) => Promise<GenerationPayload>
}

const serverInstance = new BasePackageServer(headshot1Base)

export const headshot1Server: Headshot1ServerPackage = {
  ...headshot1Base,
  buildGenerationPayload: (context: GenerationContext) => serverInstance.buildGenerationPayload(context)
}
