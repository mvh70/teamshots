import { z } from 'zod'

// Basic types for style settings
const StyleSettingSchema = z.union([
  z.object({ type: z.literal('user-choice') }),
  z.object({ type: z.string().min(1) }),
  z.object({ 
    style: z.string().min(1),
    details: z.string().optional()
  }) // Clothing specific
])

const PhotoStyleSettingsSchema = z.object({
  background: StyleSettingSchema.optional(),
  branding: StyleSettingSchema.optional(),
  clothing: StyleSettingSchema.optional(),
  clothingColors: z.object({
    type: z.string(),
    colors: z.record(z.string()).optional()
  }).optional(),
  shotType: StyleSettingSchema.optional(),
  style: StyleSettingSchema.optional(),
  expression: StyleSettingSchema.optional(),
  lighting: StyleSettingSchema.optional(),
  pose: StyleSettingSchema.optional(),
  aspectRatio: z.string().optional(),
})

// Package Schema - Simplified for validation
export const PackageConfigSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  coverImage: z.string().optional(),
  
  // Categories arrays
  visibleCategories: z.array(z.string()).min(1, "visibleCategories must not be empty"),
  compositionCategories: z.array(z.string()).optional(), // Optional but recommended
  userStyleCategories: z.array(z.string()).optional(), // Optional but recommended
  
  // Settings - simplified to avoid Zod v4 parsing issues
  // defaultSettings: PhotoStyleSettingsSchema, 
  defaultSettings: z.any(),
  
  // Options
  availableBackgrounds: z.array(z.any()).optional(),
  availablePoses: z.array(z.any()).optional(),
  availableExpressions: z.array(z.any()).optional(),
}).passthrough()

export type PackageConfig = z.infer<typeof PackageConfigSchema>

