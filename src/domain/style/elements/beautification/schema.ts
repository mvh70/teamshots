import { z } from 'zod'
import type { BeautificationValue } from './types'
import { DEFAULT_BEAUTIFICATION_VALUE } from './types'

const accessoryActionSchema = z.enum(['keep', 'remove'])

const accessoryObjectSchema = z.object({
  action: accessoryActionSchema,
})

const retouchingLevelSchema = z
  .union([z.enum(['none', 'light', 'medium', 'high']), z.literal('max')])
  .transform((value) => (value === 'max' ? 'high' : value))

export const beautificationValueSchema = z.object({
  retouching: retouchingLevelSchema,
  accessories: z
    .object({
      glasses: accessoryObjectSchema.optional(),
      facialHair: accessoryObjectSchema.optional(),
      jewelry: accessoryObjectSchema.optional(),
      piercings: accessoryObjectSchema.optional(),
      tattoos: accessoryObjectSchema.optional(),
    })
    .optional(),
})

export function normalizeBeautificationValue(input: unknown): BeautificationValue {
  const parsed = beautificationValueSchema.safeParse(input)
  if (parsed.success) {
    return parsed.data
  }

  return DEFAULT_BEAUTIFICATION_VALUE
}
