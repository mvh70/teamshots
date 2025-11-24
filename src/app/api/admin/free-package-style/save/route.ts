import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getPackageConfig } from '@/domain/style/packages'
import type { PhotoStyleSettings, BackgroundSettings, PoseSettings } from '@/types/photo-style'

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
    clothingSettings?: { type?: 'business' | 'startup' | 'black-tie' | 'user-choice'; style: 'business' | 'startup' | 'black-tie' | 'user-choice'; details?: string; colors?: { topCover?: string; topBase?: string; bottom?: string }; accessories?: string[] }
    clothingColorsSettings?: { type: 'predefined' | 'user-choice'; colors?: { topCover?: string; topBase?: string; bottom?: string; shoes?: string } }
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
    const ui: PhotoStyleSettings = {
      background: backgroundSettings || { 
        type: background as BackgroundSettings['type'] || 'user-choice',
        prompt: backgroundPrompt 
      },
      branding: branding || { type: includeLogo ? 'include' : 'exclude' },
      clothing: clothingSettings || pkg.defaultSettings.clothing,
      // Use provided settings or default to user-choice
      clothingColors: clothingColorsSettings || { type: 'user-choice' },
      shotType: shotTypeSettings || pkg.defaultSettings.shotType,
      expression: expressionSettings || pkg.defaultSettings.expression,
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
            settings: serializedSettings as unknown as Parameters<typeof prisma.context.update>[0]['data']['settings'],
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
          settings: serializedSettings as unknown as Parameters<typeof prisma.context.create>[0]['data']['settings'],
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
