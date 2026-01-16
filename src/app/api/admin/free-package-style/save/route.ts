import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma, Prisma } from '@/lib/prisma'
import { getPackageConfig } from '@/domain/style/packages'
import type { PhotoStyleSettings, BackgroundSettings, BackgroundType, PoseSettings, ExpressionSettings, ExpressionType, ClothingSettings, ClothingType, ClothingColorSettings, ShotTypeSettings, ShotTypeValue, BrandingSettings } from '@/types/photo-style'
import { predefined, userChoice } from '@/domain/style/elements/base/element-types'
import type { BrandingValue } from '@/domain/style/elements/branding/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } })
  if (!user?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const {
    contextId,
    stylePreset,
    background,
    includeLogo,
    backgroundPrompt,
    branding,
    backgroundSettings,
    clothingSettings,
    clothingColorsSettings,
    shotTypeSettings,
    expressionSettings,
    poseSettings,
    packageId
  } = body as {
    contextId?: string | null
    stylePreset: string
    background: string
    includeLogo: boolean
    backgroundPrompt?: string
    branding?: { mode: 'predefined' | 'user-choice'; value?: { type: 'include' | 'exclude'; logoKey?: string; logoAssetId?: string; position?: 'background' | 'clothing' | 'elements' } }
    backgroundSettings?: { mode: 'predefined' | 'user-choice'; value?: { type: 'office' | 'neutral' | 'gradient' | 'custom' | 'tropical-beach' | 'busy-city'; key?: string; prompt?: string; color?: string } }
    clothingSettings?: { mode: 'predefined' | 'user-choice'; value?: { type?: 'business' | 'startup' | 'black-tie'; style: 'business' | 'startup' | 'black-tie'; details?: string; colors?: { topLayer?: string; baseLayer?: string; bottom?: string }; accessories?: string[] } }
    clothingColorsSettings?: { mode: 'predefined' | 'user-choice'; value?: { topLayer?: string; baseLayer?: string; bottom?: string; shoes?: string } }
    shotTypeSettings?: { mode: 'predefined' | 'user-choice'; value?: { type: 'headshot' | 'medium-shot' | 'midchest' | 'full-body' } }
    expressionSettings?: { mode: 'predefined' | 'user-choice'; value?: { type: 'genuine_smile' | 'soft_smile' | 'neutral_serious' | 'laugh_joy' | 'contemplative' | 'confident' | 'sad' } }
    poseSettings?: PoseSettings
    packageId?: string
  }

  try {
    // Use the freepackage serializer to ensure correct format
    const pkgId = packageId || 'freepackage'
    const pkg = getPackageConfig(pkgId)
    
    // Reconstruct UI settings from the provided data
    // Now expects new format with mode and value properties
    let bgSettingConverted: BackgroundSettings
    if (backgroundSettings) {
      if (backgroundSettings.mode === 'user-choice') {
        // User can choose - optionally with a pre-selected value
        bgSettingConverted = backgroundSettings.value ? userChoice(backgroundSettings.value) : userChoice()
      } else {
        // Admin has predefined this setting
        bgSettingConverted = predefined(backgroundSettings.value || {
          type: (background as BackgroundType) || 'office',
          prompt: backgroundPrompt
        })
      }
    } else if (background === 'user-choice') {
      bgSettingConverted = userChoice()
    } else {
      bgSettingConverted = predefined({
        type: (background as BackgroundType) || 'office',
        prompt: backgroundPrompt
      })
    }

    // Convert expression settings - now expects new format with mode and value
    let exprSettingConverted: ExpressionSettings
    if (expressionSettings) {
      if (expressionSettings.mode === 'user-choice') {
        exprSettingConverted = expressionSettings.value ? userChoice(expressionSettings.value) : userChoice()
      } else {
        exprSettingConverted = predefined(expressionSettings.value || { type: 'genuine_smile' as ExpressionType })
      }
    } else {
      exprSettingConverted = pkg.defaultSettings.expression as ExpressionSettings
    }

    // Convert clothing settings - now expects new format with mode and value
    let clothingSettingConverted: ClothingSettings
    if (clothingSettings) {
      if (clothingSettings.mode === 'user-choice') {
        clothingSettingConverted = clothingSettings.value ? userChoice(clothingSettings.value) : userChoice()
      } else {
        clothingSettingConverted = predefined(clothingSettings.value || { style: 'business' as ClothingType })
      }
    } else {
      clothingSettingConverted = pkg.defaultSettings.clothing as ClothingSettings
    }

    // Convert clothingColorsSettings - now expects new format with mode and value
    let clothingColorsConverted: ClothingColorSettings
    if (clothingColorsSettings) {
      if (clothingColorsSettings.mode === 'user-choice') {
        clothingColorsConverted = clothingColorsSettings.value
          ? userChoice(clothingColorsSettings.value)
          : userChoice()
      } else {
        clothingColorsConverted = clothingColorsSettings.value
          ? predefined(clothingColorsSettings.value)
          : predefined({})
      }
    } else {
      clothingColorsConverted = userChoice()
    }

    // Convert shotType settings - now expects new format with mode and value
    let shotTypeConverted: ShotTypeSettings
    if (shotTypeSettings) {
      if (shotTypeSettings.mode === 'user-choice') {
        shotTypeConverted = shotTypeSettings.value ? userChoice(shotTypeSettings.value) : userChoice()
      } else {
        shotTypeConverted = predefined(shotTypeSettings.value || { type: 'medium-shot' as ShotTypeValue })
      }
    } else {
      shotTypeConverted = pkg.defaultSettings.shotType as ShotTypeSettings
    }

    // Convert branding - now expects new format with mode and value
    let brandingConverted: BrandingSettings
    if (branding) {
      if (branding.mode === 'user-choice') {
        // User can choose - optionally with a pre-selected value
        brandingConverted = branding.value ? userChoice(branding.value) : userChoice<BrandingValue>()
      } else {
        // Admin has predefined this setting - use predefined()
        const brandingVal: BrandingValue = branding.value || {
          type: includeLogo ? 'include' : 'exclude',
          position: 'clothing'
        }
        brandingConverted = predefined(brandingVal)
      }
    } else {
      // No branding provided - default to user-choice
      const defaultBrandingVal: BrandingValue = {
        type: includeLogo ? 'include' : 'exclude',
        position: 'clothing'
      }
      brandingConverted = userChoice(defaultBrandingVal)
    }

    const ui: PhotoStyleSettings = {
      background: bgSettingConverted,
      branding: brandingConverted,
      clothing: clothingSettingConverted,
      clothingColors: clothingColorsConverted,
      shotType: shotTypeConverted,
      expression: exprSettingConverted,
      pose: poseSettings || pkg.defaultSettings.pose
    }
    
    // Use the package serializer to ensure format matches what deserializer expects
    const serializedSettings = pkg.persistenceAdapter.serialize(ui) as Record<string, unknown>
    // Store stylePreset in settings
    serializedSettings.stylePreset = stylePreset
    
    let ctxId = contextId || null
    
    // If no contextId provided, check for existing freePackage style from appSetting
    if (!ctxId) {
      const setting = await prisma.appSetting.findUnique({ where: { key: 'freePackageStyleId' } })
      if (setting?.value) {
        // Verify the existing context still exists
        const existing = await prisma.context.findUnique({ where: { id: setting.value } })
        if (existing) {
          ctxId = setting.value
        }
      }
    }
    
    // If a contextId was provided or found, verify it exists and update it
    if (ctxId) {
      const existing = await prisma.context.findUnique({ where: { id: ctxId } })
      if (existing) {
        await prisma.context.update({
          where: { id: ctxId },
          data: {
            name: 'Free Package Style',
            settings: serializedSettings as Prisma.InputJsonValue,
          },
        })
      } else {
        ctxId = null
      }
    }

    // Only create a new context if we don't have an existing one
    if (!ctxId) {
      const ctx = await prisma.context.create({
        data: {
          name: 'Free Package Style',
          settings: serializedSettings as Prisma.InputJsonValue,
        },
        select: { id: true },
      })
      ctxId = ctx.id
    }

    await prisma.appSetting.upsert({
      where: { key: 'freePackageStyleId' },
      update: { value: ctxId! },
      create: { key: 'freePackageStyleId', value: ctxId! },
    })

    return NextResponse.json({ success: true, contextId: ctxId })
  } catch (error) {
    console.error('Error saving free package style:', error)
    return NextResponse.json({ error: 'Failed to save free package style' }, { status: 500 })
  }
}
