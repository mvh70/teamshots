import fs from 'node:fs'
import path from 'node:path'

const MESSAGES_ROOT = path.join(process.cwd(), 'messages')
const ACTIVE_TENANT_FILES = ['shared', 'teamshotspro', 'individualshots', 'rightclickfit'] as const

function readLocaleFile(locale: string, fileKey: string): Record<string, unknown> {
  const fullPath = path.join(MESSAGES_ROOT, locale, `${fileKey}.json`)

  try {
    const raw = fs.readFileSync(fullPath, 'utf8')
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    // Mirrors i18n request fallback: missing tenant file should not hard-fail.
    return {}
  }
}

describe('message file baseline for active tenants', () => {
  it('has all active tenant files in messages/en', () => {
    for (const fileKey of ACTIVE_TENANT_FILES) {
      const fullPath = path.join(MESSAGES_ROOT, 'en', `${fileKey}.json`)
      expect(fs.existsSync(fullPath)).toBe(true)
    }
  })

  it('degrades softly when locale-specific tenant file is missing in messages/es', () => {
    const shared = readLocaleFile('es', 'shared')
    const missingTenant = readLocaleFile('es', 'rightclickfit')

    expect(Object.keys(shared).length).toBeGreaterThan(0)
    expect(missingTenant).toEqual({})
  })
})
