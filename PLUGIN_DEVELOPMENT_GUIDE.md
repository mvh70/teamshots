# Plugin Development Guide

**Version**: 1.0.0
**Date**: 2025-12-19
**Status**: Phase 1 Complete ✅

---

## Table of Contents

1. [Introduction](#introduction)
2. [Quick Start](#quick-start)
3. [Architecture Overview](#architecture-overview)
4. [Creating a Package](#creating-a-package)
5. [Package Lifecycle](#package-lifecycle)
6. [Element System](#element-system)
7. [Asset Preparation](#asset-preparation)
8. [Testing](#testing)
9. [Publishing](#publishing)
10. [Best Practices](#best-practices)
11. [API Reference](#api-reference)

---

## Introduction

The TeamShots Plugin Architecture allows you to create custom style packages without modifying core code. Packages are self-contained, auto-registering modules that define how AI-generated images are created.

### What You Can Build

- **Custom style packages** (e.g., corporate headshots, creative portraits, team photos)
- **Custom elements** (e.g., special effects, unique poses, custom lighting)
- **Workflow extensions** (e.g., asset preparation, post-processing)
- **Integration packages** (e.g., external APIs, custom models)

### System Requirements

- Node.js 18+
- TypeScript 5+
- TeamShots v1.0.0+

---

## Quick Start

### 1. Create Your Package

```bash
# Copy the example template
cp -r src/domain/style/packages/_example-package src/domain/style/packages/my-awesome-package

# Navigate to your package
cd src/domain/style/packages/my-awesome-package
```

### 2. Update Package Configuration

Edit `package.ts`:

```typescript
export const myAwesomePackage: ServerStylePackage = {
  id: 'my-awesome-package',          // Unique ID
  label: 'My Awesome Package',        // Display name
  version: 1,                         // Package version

  // ... configuration

  async buildGenerationPayload(context) {
    // Your custom logic here
  }
}
```

### 3. Import and Use

```typescript
// src/domain/style/packages/server.ts
import './my-awesome-package/package'  // Auto-registers!
```

### 4. Test

```bash
npm run build
npm run dev
```

Your package is now available! 🎉

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────┐
│         Package Registry                │
│  - Discovers packages                   │
│  - Validates compatibility              │
│  - Manages lifecycle                    │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│         Style Packages                  │
│  - Define UI configuration              │
│  - Build generation payloads            │
│  - Provide custom elements              │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│         Element System                  │
│  - Modular prompt builders              │
│  - Priority-based composition           │
│  - Phase-aware contributions            │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│         Generation Workflow             │
│  - Step 0: Asset preparation            │
│  - Step 1a: Person generation           │
│  - Step 1b: Background generation       │
│  - Step 2: Final composition            │
└─────────────────────────────────────────┘
```

### Key Principles

1. **Self-Contained**: Packages don't modify core files
2. **Auto-Discovery**: Import triggers registration
3. **Composable**: Packages can share and combine elements
4. **Validated**: Automatic validation before registration
5. **Lifecycle-Managed**: Init, register, unregister hooks

---

## Creating a Package

### Minimal Package

```typescript
import type { ServerStylePackage } from '../types'
import type { PhotoStyleSettings } from '@/types/photo-style'
import type { GenerationContext, GenerationPayload } from '@/types/generation'

export const minimalPackage: ServerStylePackage = {
  // === REQUIRED ===
  id: 'minimal-package',
  label: 'Minimal Package',
  version: 1,
  visibleCategories: ['background', 'pose'],
  defaultSettings: {
    background: { type: 'office' },
    pose: { type: 'power_classic' },
  },
  defaultPresetId: 'CORPORATE_HEADSHOT',

  async buildGenerationPayload(context: GenerationContext): Promise<GenerationPayload> {
    const prompt = {
      task: 'Generate professional headshot',
      subject: { identity: 'From selfies' },
    }

    return {
      prompt: JSON.stringify(prompt, null, 2),
      mustFollowRules: ['Professional quality'],
      freedomRules: [],
      referenceImages: [],
      aspectRatio: '1:1',
      aspectRatioDescription: 'Square',
    }
  },

  extractUiSettings: (raw) => ({
    background: raw.background as any,
    pose: raw.pose as any,
  }),

  persistenceAdapter: {
    serialize: (ui) => ({ settings: ui }),
    deserialize: (raw: any) => raw.settings || raw,
  },

  promptBuilder: (settings) => JSON.stringify(settings, null, 2),
}

// Auto-register
import { packageRegistry } from '../registry'
if (typeof window === 'undefined') {
  packageRegistry.register(minimalPackage)
}
```

### Complete Package with All Features

```typescript
import type { ServerStylePackage, PackageMetadata } from '../types'
import { StyleElement, type ElementContext, type ElementContribution } from '../../elements/base/StyleElement'
import { Logger } from '@/lib/logger'

// Custom element (optional)
class MyCustomElement extends StyleElement {
  readonly id = 'my-element'
  readonly name = 'My Element'
  readonly description = 'Custom element for my package'

  get priority(): number { return 80 }

  isRelevantForPhase(context: ElementContext): boolean {
    return context.phase === 'person-generation'
  }

  async contribute(context: ElementContext): Promise<ElementContribution> {
    return {
      instructions: ['My custom instruction'],
      mustFollow: ['My custom rule'],
      metadata: { myData: 'value' },
    }
  }

  validate(settings: PhotoStyleSettings): string[] {
    return []
  }
}

// Package metadata
const metadata: PackageMetadata = {
  author: 'Your Name',
  description: 'Full-featured package example',
  homepage: 'https://github.com/your-org/package',
  license: 'MIT',
  compatibility: {
    minVersion: '1.0.0',
    requires: [],
    optional: ['headshot1'],
  },
  capabilities: {
    supportsBranding: true,
    supportsCustomBackgrounds: true,
    supportedWorkflowVersions: ['v3'],
  },
}

// Package definition
export const completePackage: ServerStylePackage = {
  id: 'complete-package',
  label: 'Complete Package',
  version: 1,

  // Enhanced fields
  featureFlag: 'myPackageFlag',
  metadata,
  requiredElements: ['subject', 'pose'],
  providedElements: [new MyCustomElement()],

  // Lifecycle hooks
  async initialize() {
    Logger.info('[CompletePackage] Initializing')
    // Setup code here
  },

  async validate() {
    return { valid: true, errors: [], warnings: [] }
  },

  onRegister() {
    Logger.info('[CompletePackage] Registered')
  },

  onUnregister() {
    Logger.info('[CompletePackage] Unregistering')
  },

  // Asset preparation
  async prepareAssets(context) {
    return {
      'my-asset': {
        base64: '...',
        mimeType: 'image/png',
        metadata: { source: 'generated' },
      },
    }
  },

  // Standard fields
  visibleCategories: ['background', 'pose', 'expression'],
  defaultSettings: { /* ... */ },
  defaultPresetId: 'CORPORATE_HEADSHOT',

  async buildGenerationPayload(context) {
    // Your generation logic
    return { /* ... */ }
  },

  extractUiSettings: (raw) => ({ /* ... */ }),
  persistenceAdapter: { /* ... */ },
  promptBuilder: (settings) => JSON.stringify(settings),
}

// Auto-register
import { packageRegistry } from '../registry'
if (typeof window === 'undefined') {
  packageRegistry.register(completePackage).catch(console.error)
}
```

---

## Package Lifecycle

### Registration Flow

```
1. Import package file
       ↓
2. Package attempts auto-registration
       ↓
3. Registry validates package
   - Check required fields
   - Validate dependencies
   - Check required elements
   - Call package.validate()
       ↓
4. Registry checks feature flag
       ↓
5. Registry registers package
       ↓
6. Registry registers provided elements
       ↓
7. Call package.onRegister()
       ↓
8. Package ready for use
```

### Lifecycle Hooks

```typescript
{
  /**
   * Called once when package is first loaded
   * Use for: Setup, resource loading, API connections
   */
  async initialize(): Promise<void> {
    // One-time setup
    await loadExternalResources()
    await connectToAPI()
  },

  /**
   * Called before registration
   * Use for: Validating configuration, checking environment
   */
  async validate(): Promise<PackageValidationResult> {
    const errors: string[] = []

    if (!process.env.MY_API_KEY) {
      errors.push('MY_API_KEY environment variable required')
    }

    return { valid: errors.length === 0, errors, warnings: [] }
  },

  /**
   * Called after successful registration
   * Use for: Logging, notifications, telemetry
   */
  onRegister(): void {
    Logger.info('[MyPackage] Successfully registered')
    trackEvent('package_registered', { packageId: this.id })
  },

  /**
   * Called before package is removed
   * Use for: Cleanup, closing connections, saving state
   */
  onUnregister(): void {
    closeAPIConnection()
    saveState()
    Logger.info('[MyPackage] Unregistered')
  },
}
```

---

## Element System

### What Are Elements?

Elements are modular units that contribute specific aspects to prompt generation:
- **Subject**: Identity preservation, facial accuracy
- **Pose**: Body positioning, posture
- **Lighting**: Light setup, quality, direction
- **Background**: Scene and environment
- **Custom**: Your unique functionality

### Creating Custom Elements

```typescript
import { StyleElement, type ElementContext, type ElementContribution } from '../../elements/base/StyleElement'

export class VintageFilterElement extends StyleElement {
  readonly id = 'vintage-filter'
  readonly name = 'Vintage Filter'
  readonly description = 'Applies vintage photo aesthetic'

  // Priority (10-100, lower executes first)
  // Core elements: 10-70
  // Custom elements: 80-100
  get priority(): number {
    return 85
  }

  // Determine if element should contribute
  isRelevantForPhase(context: ElementContext): boolean {
    const { phase, settings } = context

    // Only if vintage filter enabled
    if (!settings.customSettings?.vintageFilter) {
      return false
    }

    // Only contribute to final composition
    return phase === 'composition'
  }

  // Generate prompt contributions
  async contribute(context: ElementContext): Promise<ElementContribution> {
    const { settings } = context
    const intensity = settings.customSettings?.vintageIntensity || 'medium'

    return {
      instructions: [
        'Apply vintage photographic aesthetic',
        `Intensity level: ${intensity}`,
        'Include subtle film grain texture',
        'Warm color temperature shift',
      ],
      mustFollow: [
        'Vintage effect must enhance, not overwhelm',
        'Subject must remain clearly visible',
        'Colors must be warm-toned (sepia/amber)',
      ],
      freedom: [
        'Adjust grain amount for best aesthetic',
        'Fine-tune vignette strength',
      ],
      metadata: {
        filterType: 'vintage',
        intensity,
      },
    }
  }

  // Validate settings
  validate(settings: PhotoStyleSettings): string[] {
    const errors: string[] = []
    const intensity = settings.customSettings?.vintageIntensity

    if (intensity && !['low', 'medium', 'high'].includes(intensity)) {
      errors.push(`Invalid vintage intensity: ${intensity}`)
    }

    return errors
  }

  // Optional: Prepare assets
  async prepare(context: ElementContext): Promise<PreparedAsset> {
    // Download vintage textures, LUTs, etc.
    const texture = await downloadVintageTexture()

    return {
      elementId: this.id,
      assetType: 'vintage-texture',
      data: {
        base64: texture.base64,
        mimeType: 'image/png',
      },
    }
  }

  // Optional: Check if preparation needed
  needsPreparation(context: ElementContext): boolean {
    return !!context.settings.customSettings?.vintageFilter
  }
}
```

### Registering Elements

Elements can be registered three ways:

**1. Via Package (Recommended)**
```typescript
export const myPackage: ServerStylePackage = {
  providedElements: [
    new VintageFilterElement(),
    new RetroEffectElement(),
  ],
  // ...
}
```
Package-provided elements are automatically registered when the package is registered.

**2. Self-Registration (For Standalone Elements)**
```typescript
// At end of element file - RECOMMENDED PATTERN
import { autoRegisterElement } from '../../composition/registry'

export const vintageFilter = new VintageFilterElement()
export default vintageFilter

// Auto-register on import (server-side only)
autoRegisterElement(vintageFilter)
```

The `autoRegisterElement` helper:
- Only registers in server environment (checks `typeof window === 'undefined'`)
- Handles duplicate registration gracefully
- Logs errors clearly for debugging

**3. Manual Registration (Legacy)**
```typescript
import { compositionRegistry } from '../elements/composition/registry'

// Manual registration - only use if you need explicit control
compositionRegistry.register(new VintageFilterElement())
```

### Element Dependencies

Elements can declare dependencies on other elements using `before`, `after`, and `dependsOn`:

```typescript
export class LogoEnhancementElement extends StyleElement {
  readonly id = 'logo-enhancement'
  readonly name = 'Logo Enhancement'

  // Execution order dependencies
  get after(): string[] | undefined {
    return ['branding']  // Run AFTER branding element
  }

  get before(): string[] | undefined {
    return ['background']  // Run BEFORE background element
  }

  // Hard dependencies (must be registered)
  get dependsOn(): string[] | undefined {
    return ['branding']  // Requires branding element to exist
  }

  // Priority is still used for elements without dependencies
  get priority(): number {
    return 65
  }

  isRelevantForPhase(context: ElementContext): boolean {
    // Only relevant if branding element contributed a logo
    const brandingContribution = context.existingContributions.find(
      (c) => c.metadata?.['branding']
    )
    return !!brandingContribution && context.phase === 'composition'
  }

  async contribute(context: ElementContext): Promise<ElementContribution> {
    // Enhance the logo that was added by branding element
    return {
      instructions: ['Enhance logo visibility with subtle glow'],
      mustFollow: ['Logo enhancement must be subtle'],
    }
  }
}
```

**Dependency Resolution**:
- Elements are sorted using **topological sort** (Kahn's algorithm)
- **Circular dependencies** are detected and raise an error
- **Priority** is used as a tie-breaker when no dependencies exist
- Missing `dependsOn` elements cause validation errors

**Best Practices**:
- Use `after` to see other elements' contributions
- Use `before` to let other elements see your contributions
- Use `dependsOn` for hard requirements (element must exist)
- Keep dependency chains shallow to avoid complexity

---

## Asset Preparation

### Overview

Asset preparation happens in **Step 0** before generation starts. This is where you:
- Download external resources
- Transform images
- Generate collages or composites
- Prepare any data needed for generation

### Package-Level Preparation

```typescript
export const myPackage: ServerStylePackage = {
  async prepareAssets(context: GenerationContext): Promise<PackagePreparedAssets> {
    const { generationId, styleSettings } = context

    // Example: Download custom resources
    const customBackground = await downloadBackgroundImage(
      styleSettings.background?.customUrl
    )

    // Example: Generate composite
    const collage = await createPhotoCollage(
      context.selfieKeys,
      styleSettings.layout
    )

    return {
      'custom-background': {
        base64: customBackground.base64,
        mimeType: 'image/jpeg',
        metadata: { source: 'external' },
      },
      'photo-collage': {
        base64: collage.base64,
        mimeType: 'image/png',
        metadata: { itemCount: context.selfieKeys.length },
      },
    }
  },
}
```

### Element-Level Preparation

```typescript
export class MyElement extends StyleElement {
  needsPreparation(context: ElementContext): boolean {
    // Check if this element needs to prepare anything
    return !!context.settings.myCustomSetting
  }

  async prepare(context: ElementContext): Promise<PreparedAsset> {
    const { generationId, generationContext } = context

    // Use downloadAsset service if available
    const downloadAsset = generationContext.downloadAsset

    if (downloadAsset) {
      const asset = await downloadAsset('my-asset-key')

      return {
        elementId: this.id,
        assetType: 'my-asset',
        data: {
          base64: asset.base64,
          mimeType: asset.mimeType,
        },
      }
    }

    throw new Error('downloadAsset service not available')
  }

  async contribute(context: ElementContext): Promise<ElementContribution> {
    // Access prepared assets
    const preparedAssets = context.generationContext.preparedAssets
    const myAsset = preparedAssets?.get(`${this.id}-my-asset`)

    if (myAsset?.data.base64) {
      return {
        referenceImages: [{
          url: `data:${myAsset.data.mimeType};base64,${myAsset.data.base64}`,
          description: 'My custom asset',
          type: 'custom',
        }],
      }
    }

    return {}
  }
}
```

---

## Testing

### Unit Tests

```typescript
import { describe, it, expect } from '@jest/globals'
import { myPackage } from './package'

describe('MyPackage', () => {
  it('should have valid configuration', () => {
    expect(myPackage.id).toBe('my-package')
    expect(myPackage.version).toBeGreaterThan(0)
    expect(myPackage.buildGenerationPayload).toBeDefined()
  })

  it('should build valid payload', async () => {
    const payload = await myPackage.buildGenerationPayload({
      generationId: 'test-123',
      personId: 'person-123',
      styleSettings: myPackage.defaultSettings,
      selfieKeys: ['selfie1.jpg'],
      processedSelfies: { 'selfie1.jpg': Buffer.from('...') },
      options: { workflowVersion: 'v3' },
    })

    expect(payload.prompt).toBeDefined()
    expect(payload.mustFollowRules).toBeInstanceOf(Array)
    expect(payload.aspectRatio).toBe('1:1')
  })

  it('should validate correctly', async () => {
    const result = await myPackage.validate?.()

    expect(result?.valid).toBe(true)
    expect(result?.errors).toHaveLength(0)
  })
})
```

### Integration Tests

```typescript
import { packageRegistry } from '../registry'
import { myPackage } from './package'

describe('MyPackage Integration', () => {
  beforeEach(() => {
    packageRegistry.clear()
  })

  it('should register successfully', async () => {
    const result = await packageRegistry.register(myPackage)

    expect(result.valid).toBe(true)
    expect(packageRegistry.has(myPackage.id)).toBe(true)
  })

  it('should initialize on registration', async () => {
    const initSpy = jest.spyOn(myPackage, 'initialize')

    await packageRegistry.register(myPackage)

    expect(initSpy).toHaveBeenCalled()
  })

  it('should register provided elements', async () => {
    await packageRegistry.register(myPackage)

    const elements = compositionRegistry.getAll()
    const myElement = elements.find(e => e.id === 'my-element')

    expect(myElement).toBeDefined()
  })
})
```

---

## Publishing

### As Internal Package

1. **Commit to repository**
```bash
git add src/domain/style/packages/my-package
git commit -m "Add my-package"
git push
```

2. **Import in server.ts**
```typescript
// src/domain/style/packages/server.ts
import './my-package/package'
```

3. **Team members pull and use**
```bash
git pull
npm run build
```

### As NPM Package

1. **Create package.json**
```json
{
  "name": "@your-org/teamshots-my-package",
  "version": "1.0.0",
  "description": "My custom TeamShots package",
  "main": "dist/package.js",
  "types": "dist/package.d.ts",
  "files": ["dist"],
  "peerDependencies": {
    "@teamshots/core": "^1.0.0"
  },
  "keywords": ["teamshots", "plugin", "package"],
  "author": "Your Name",
  "license": "MIT"
}
```

2. **Build and publish**
```bash
npm run build
npm publish
```

3. **Install and use**
```bash
npm install @your-org/teamshots-my-package
```

```typescript
// src/domain/style/packages/server.ts
import '@your-org/teamshots-my-package'
```

---

## Best Practices

### 1. Package Design

✅ **DO:**
- Keep packages focused on one style/use case
- Use descriptive IDs and labels
- Provide complete metadata
- Document your package thoroughly
- Version your package properly

❌ **DON'T:**
- Create "kitchen sink" packages
- Use generic IDs like "package1"
- Skip validation
- Hardcode configuration values
- Modify core files

### 2. Element Design

✅ **DO:**
- Create elements for reusable functionality
- Use appropriate priorities (80+ for custom)
- Validate settings thoroughly
- Log important events
- Handle errors gracefully

❌ **DON'T:**
- Create elements for one-off logic
- Use priorities conflicting with core (10-70)
- Assume settings are valid
- Swallow errors silently
- Block on synchronous operations

### 3. Performance

✅ **DO:**
- Prepare assets in Step 0 (async)
- Cache expensive computations
- Use parallel operations where possible
- Minimize external API calls
- Log performance metrics

❌ **DON'T:**
- Download assets during prompt building
- Repeat expensive operations
- Make synchronous external calls
- Ignore preparation opportunities
- Skip performance testing

### 4. Security

✅ **DO:**
- Validate all user inputs
- Sanitize file paths
- Use environment variables for secrets
- Validate external data
- Log security events

❌ **DON'T:**
- Trust user input
- Hardcode API keys
- Execute arbitrary code
- Skip input validation
- Expose sensitive data in logs

---

## API Reference

### Package Interface

```typescript
interface ServerStylePackage {
  // Required
  id: string
  label: string
  version: number
  visibleCategories: CategoryType[]
  defaultSettings: PhotoStyleSettings
  defaultPresetId: string
  buildGenerationPayload: (context: GenerationContext) => Promise<GenerationPayload>
  extractUiSettings: (raw: Record<string, unknown>) => PhotoStyleSettings
  persistenceAdapter: {
    serialize: (ui: PhotoStyleSettings) => Record<string, unknown>
    deserialize: (raw: Record<string, unknown>) => PhotoStyleSettings
  }
  promptBuilder: (settings: PhotoStyleSettings) => string | Record<string, unknown>

  // Optional
  featureFlag?: string
  metadata?: PackageMetadata
  requiredElements?: string[]
  providedElements?: StyleElement[]
  initialize?(): Promise<void>
  validate?(): Promise<PackageValidationResult>
  onRegister?(): void
  onUnregister?(): void
  prepareAssets?(context: GenerationContext): Promise<PackagePreparedAssets>
}
```

### Registry Methods

```typescript
class PackageRegistry {
  // Register a package
  async register(pkg: ServerStylePackage, options?: {
    skipValidation?: boolean
    force?: boolean
  }): Promise<PackageValidationResult>

  // Unregister a package
  async unregister(packageId: string): Promise<void>

  // Get package by ID
  get(id: string): ServerStylePackage | undefined

  // Get all packages
  getAll(): ServerStylePackage[]

  // Check if package exists
  has(id: string): boolean

  // Initialize all packages
  async initialize(): Promise<void>

  // Discover packages from filesystem
  async discover(): Promise<string[]>

  // Validate package
  async validatePackage(pkg: ServerStylePackage): Promise<PackageValidationResult>

  // Get packages by capability
  getByCapability(capability: keyof PackageCapabilities): ServerStylePackage[]
}
```

### Element Interface

```typescript
abstract class StyleElement {
  abstract readonly id: string
  abstract readonly name: string
  abstract readonly description: string
  abstract get priority(): number

  abstract isRelevantForPhase(context: ElementContext): boolean
  abstract contribute(context: ElementContext): Promise<ElementContribution>
  abstract validate(settings: PhotoStyleSettings): string[]

  // Optional
  needsPreparation?(context: ElementContext): boolean
  prepare?(context: ElementContext): Promise<PreparedAsset>
}
```

---

## Examples

See:
- `src/domain/style/packages/_example-package/` - Complete example
- `src/domain/style/packages/outfit1/` - Production example
- `src/domain/style/packages/headshot1/` - Simple example

---

## Support

- **Documentation**: `ARCHITECTURE_REVIEW.md`
- **Examples**: `_example-package/`
- **Issues**: GitHub Issues
- **Community**: Discord/Slack

---

## Changelog

### v1.0.0 (2025-12-19)
- ✨ Initial plugin architecture release
- ✨ Package registry with auto-discovery
- ✨ Lifecycle hooks
- ✨ Element system integration
- ✨ Asset preparation support
- 📚 Complete documentation

---

**Happy Plugin Development!** 🚀
