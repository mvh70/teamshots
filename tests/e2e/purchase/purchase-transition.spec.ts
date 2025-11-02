import { test, expect } from '@playwright/test'
import { PrismaClient, Prisma } from '@prisma/client'

test.describe('Purchase transitions lift free-style enforcement', () => {
  let prisma: PrismaClient

  test.beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/teamshots_test?schema=public'
        }
      }
    })
  })

  test.afterAll(async () => {
    await prisma.$disconnect()
  })

  test('switching user.planTier from free → individual lifts enforcement', async ({ page }) => {
    // Arrange: set a freePackageStyleId and create a free user with a selfie
    let ctx = await prisma.context.findFirst()
    if (!ctx) {
      ctx = await prisma.context.create({ data: { name: 'free-style', stylePreset: 'corporate' } })
    }
    type PrismaWithAppSetting = PrismaClient & { appSetting: { upsert: (...args: unknown[]) => Promise<unknown> } }
    const prismaEx = prisma as unknown as PrismaWithAppSetting
    await prismaEx.appSetting.upsert({
      where: { key: 'freePackageStyleId' },
      update: { value: ctx.id },
      create: { key: 'freePackageStyleId', value: ctx.id },
    })

    const user = await prisma.user.create({ data: { email: `transition-${Date.now()}@example.com`, locale: 'en', planTier: 'free', planPeriod: 'none' } as Prisma.UserCreateInput })
    const person = await prisma.person.create({ data: { firstName: 'Buyer', email: user.email, userId: user.id } })
    const selfie = await prisma.selfie.create({ data: { personId: person.id, key: `selfie-${Date.now()}` } })

    await page.setExtraHTTPHeaders({
      'x-e2e-user-id': user.id,
      'x-e2e-user-email': user.email,
      'x-e2e-user-role': 'user',
      'x-e2e-user-locale': 'en'
    })

    // First generation (free): should be forced to free style
    const first = await page.request.post('https://localhost:3000/api/generations/create', {
      data: {
        selfieId: selfie.id,
        prompt: 'Corporate headshot',
        generationType: 'personal',
        creditSource: 'individual'
      }
    })
    expect(first.status()).toBeLessThan(400)
    const firstJson = await first.json()
    const genFree = await prisma.generation.findUnique({ where: { id: firstJson.generationId } })
    expect(genFree?.contextId).toBe(ctx.id)

    // Simulate purchase completion by updating the user's plan (acts as post-webhook state)
    await prisma.user.update({ where: { id: user.id }, data: { planTier: 'individual', planPeriod: 'monthly' } as Prisma.UserUpdateInput })

    // Create a custom context to choose (not the free style context)
    const customCtx = await prisma.context.create({ data: { name: `custom-${Date.now()}`, stylePreset: 'casual', settings: { theme: 'custom' } as unknown as Prisma.InputJsonValue } })

    // Second generation: should NOT be forced; allow chosen context via contextId
    const second = await page.request.post('https://localhost:3000/api/generations/create', {
      data: {
        selfieId: selfie.id,
        contextId: customCtx.id,
        prompt: 'Casual portrait',
        generationType: 'personal',
        creditSource: 'individual'
      }
    })
    expect(second.status()).toBeLessThan(400)
    const secondJson = await second.json()
    const genPaid = await prisma.generation.findUnique({ where: { id: secondJson.generationId } })
    expect(genPaid?.contextId).toBe(customCtx.id)
  })
})


