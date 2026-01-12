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
    branding?: { type: 'include' | 'exclude' | 'user-choice'; logoKey?: string; position?: 'background' | 'clothing' | 'elements' }
    backgroundSettings?: { type: 'office' | 'neutral' | 'gradient' | 'custom' | 'user-choice' | 'tropical-beach' | 'busy-city'; key?: string; prompt?: string; color?: string }
    clothingSettings?: { type?: 'business' | 'startup' | 'black-tie' | 'user-choice'; style: 'business' | 'startup' | 'black-tie' | 'user-choice'; details?: string; colors?: { topLayer?: string; baseLayer?: string; bottom?: string }; accessories?: string[] }
    clothingColorsSettings?: { type: 'predefined' | 'user-choice'; colors?: { topLayer?: string; baseLayer?: string; bottom?: string; shoes?: string } }
    shotTypeSettings?: { type: 'headshot' | 'midchest' | 'full-body' | 'user-choice' }
    expressionSettings?: { type: 'genuine_smile' | 'soft_smile' | 'neutral_serious' | 'laugh_joy' | 'contemplative' | 'confident' | 'sad' | 'user-choice' }
    poseSettings?: PoseSettings
    packageId?: string
  }

  try {
    // Use the freepackage serializer to ensure correct format
    const pkgId = packageId || 'freepackage'
    const pkg = getPackageConfig(pkgId)
    
    // Reconstruct UI settings from the provided data
    // Preserve undefined/null for user-choice states instead of defaulting
    // Convert legacy background settings to new format
    let bgSettingConverted: BackgroundSettings
    if (backgroundSettings) {
      // If backgroundSettings provided in legacy format, convert it
      if (backgroundSettings.type === 'user-choice') {
        bgSettingConverted = userChoice()
      } else {
        bgSettingConverted = predefined({
          type: backgroundSettings.type as BackgroundType,
          key: backgroundSettings.key,
          prompt: backgroundSettings.prompt,
          color: backgroundSettings.color
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

    // Convert legacy expression settings to new format
    let exprSettingConverted: ExpressionSettings
    if (expressionSettings) {
      if (expressionSettings.type === 'user-choice') {
        exprSettingConverted = userChoice()
      } else {
        exprSettingConverted = predefined({ type: expressionSettings.type as ExpressionType })
      }
    } else {
      exprSettingConverted = pkg.defaultSettings.expression as ExpressionSettings
    }

    // Convert legacy clothing settings to new format
    let clothingSettingConverted: ClothingSettings
    if (clothingSettings) {
      if (clothingSettings.style === 'user-choice' || clothingSettings.type === 'user-choice') {
        clothingSettingConverted = userChoice()
      } else {
        clothingSettingConverted = predefined({
          type: clothingSettings.type as ClothingType | undefined,
          style: clothingSettings.style as ClothingType,
          details: clothingSettings.details,
          colors: clothingSettings.colors,
          accessories: clothingSettings.accessories
        })
      }
    } else {
      clothingSettingConverted = pkg.defaultSettings.clothing as ClothingSettings
    }

    // Convert clothingColorsSettings from legacy format if provided
    let clothingColorsConverted: ClothingColorSettings
    if (clothingColorsSettings) {
      if (clothingColorsSettings.type === 'user-choice') {
        clothingColorsConverted = clothingColorsSettings.colors
          ? userChoice(clothingColorsSettings.colors)
          : userChoice()
      } else {
        clothingColorsConverted = clothingColorsSettings.colors
          ? predefined(clothingColorsSettings.colors)
          : predefined({})
      }
    } else {
      clothingColorsConverted = userChoice()
    }

    // Convert legacy shotType settings to new format
    let shotTypeConverted: ShotTypeSettings
    if (shotTypeSettings) {
      if (shotTypeSettings.type === 'user-choice') {
        shotTypeConverted = userChoice()
      } else {
        shotTypeConverted = predefined({ type: shotTypeSettings.type as ShotTypeValue })
      }
    } else {
      shotTypeConverted = pkg.defaultSettings.shotType as ShotTypeSettings
    }

    // Convert branding to new format
    let brandingConverted: BrandingSettings
    if (branding) {
      if (branding.type === 'user-choice') {
        brandingConverted = userChoice<BrandingValue>()
      } else {
        const brandingVal: BrandingValue = {
          type: branding.type,
          logoKey: branding.logoKey,
          position: branding.position
        }
        brandingConverted = userChoice(brandingVal)
      }
    } else {
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
