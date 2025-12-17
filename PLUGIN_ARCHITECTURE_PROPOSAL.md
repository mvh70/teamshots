# Plugin Architecture Proposal

## Executive Summary

**Goal**: Enable plug-and-play style packages and workflows without modifying existing code.

**Current State**: Adding a new package requires manual registration in 2+ files, understanding complex boilerplate, and modifying worker code for new workflows.

**Proposed State**: Drop a package directory with a manifest file, restart the server, and it's automatically available. No code changes required.

---

## Current Architecture Problems

### Problem 1: Manual Package Registration

**Location**: `src/domain/style/packages/server.ts` and `src/domain/style/packages/index.ts`

**Issue**: Every new package requires:
1. Adding an import statement: `import { outfit1Server } from './outfit1/server'`
2. Adding to registry object: `outfit1: outfit1Server`
3. Duplicating feature flag logic in both client and server files
4. Rebuilding and redeploying the application

**Example** (current pattern):
```typescript
// server.ts
import { headshot1Server } from './headshot1/server'
import { outfit1Server } from './outfit1/server'

export const SERVER_PACKAGES = {
  headshot1: headshot1Server,
  outfit1: isFeatureEnabled('outfitTransfer') ? outfit1Server : undefined
}
```

**Impact**: Violates Open-Closed Principle. Cannot add packages without modifying existing code.

---

### Problem 2: Hard-Coded Workflow Routing

**Location**: `src/queue/workers/generateImage.ts` (lines 590-650 approx)

**Issue**: Workflow version selection uses explicit if-else conditionals:
```typescript
if (workflowVersion === 'v3') {
  // V3-specific setup
  result = await executeV3Workflow(...)
} else if (workflowVersion === 'v2') {
  // V2-specific setup
  result = await executeV2Workflow(...)
}
```

**Impact**: Adding a new workflow (v4, or package-specific workflow) requires editing worker code. Cannot extend workflow system without modification.

---

### Problem 3: Package Implementation Boilerplate

**Location**: Each package's `server.ts` file

**Issue**: Packages must implement significant boilerplate:
- Extend base client package
- Merge three-tier settings hierarchy (package defaults, preset defaults, user settings)
- Resolve aspect ratios
- Build prompts using shared utilities
- Handle debug logging

**Example** (required in every package):
```typescript
export const myPackageServer: ServerStylePackage = {
  ...myPackageBase,
  buildGenerationPayload: async (context) => {
    // 50+ lines of boilerplate
    const settings = mergeSettings(packageDefaults, presetDefaults, userSettings)
    const aspectRatio = resolveAspectRatioConfig(settings.aspectRatio)
    const prompt = buildPrompt(settings, context)
    // ... more boilerplate
  }
}
```

**Impact**: High barrier to entry. Developers must understand complex settings hierarchy and prompt building system to create simple packages.

---

### Problem 4: Duplicate Client/Server Registration

**Issue**: Package registry maintained separately in `server.ts` and `index.ts` with duplicated feature flag logic.

**Impact**:
- Double the maintenance burden
- Risk of client/server registry mismatch
- Feature flags checked in two places

---

## Proposed Plugin Architecture

### Design Principles

1. **Convention over Configuration**: Packages follow standard directory structure and are auto-discovered
2. **Single Source of Truth**: Package manifest defines all metadata, capabilities, and dependencies
3. **Zero-Touch Deployment**: Adding a package requires no changes to existing code
4. **Graceful Degradation**: Invalid packages are logged and skipped, not crash the system
5. **Backward Compatible**: Existing packages continue to work during migration

---

### Solution 1: Package Manifest System

**Create**: `src/domain/style/packages/[package-id]/package.json`

**Specification**:
```typescript
{
  "id": "outfit1",
  "version": "1.0.0",
  "name": "Outfit Transfer",
  "description": "Professional photos with custom clothing",

  // Client metadata
  "client": {
    "label": "Outfit Transfer",
    "visibleCategories": ["background", "camera", "lighting"],
    "defaultSettings": { ... }
  },

  // Server capabilities
  "server": {
    "workflowVersion": "v3",  // Which workflow this package uses
    "supportsMultipleSelfies": true,
    "requiresCustomClothing": false
  },

  // Feature flags (optional)
  "featureFlag": "outfitTransfer",

  // Entry points
  "entry": {
    "client": "./index.ts",
    "server": "./server.ts"
  }
}
```

**Benefits**:
- Single source of truth for package metadata
- Clear declaration of capabilities and requirements
- Enables validation before loading
- Self-documenting

---

### Solution 2: Auto-Discovery Package Loader

**Create**: `src/domain/style/packages/loader.ts`

**Implementation**:
```typescript
import fs from 'fs'
import path from 'path'

interface PackageManifest {
  id: string
  version: string
  client: ClientConfig
  server: ServerConfig
  featureFlag?: string
  entry: {
    client: string
    server: string
  }
}

export async function loadServerPackages(): Promise<Record<string, ServerStylePackage>> {
  const packagesDir = path.join(__dirname, './')
  const packageDirs = fs.readdirSync(packagesDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)

  const packages: Record<string, ServerStylePackage> = {}

  for (const packageId of packageDirs) {
    try {
      // Read manifest
      const manifestPath = path.join(packagesDir, packageId, 'package.json')
      if (!fs.existsSync(manifestPath)) {
        continue // Skip directories without manifest
      }

      const manifest: PackageManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))

      // Check feature flag
      if (manifest.featureFlag && !isFeatureEnabled(manifest.featureFlag)) {
        Logger.info(`Package ${packageId} disabled by feature flag: ${manifest.featureFlag}`)
        continue
      }

      // Dynamically import server entry point
      const serverEntryPath = path.join(packagesDir, packageId, manifest.entry.server)
      const serverModule = await import(serverEntryPath)

      // Validate package implements required interface
      const serverPackage = serverModule.default || serverModule[`${packageId}Server`]
      if (!serverPackage || typeof serverPackage.buildGenerationPayload !== 'function') {
        Logger.error(`Package ${packageId} does not implement ServerStylePackage interface`)
        continue
      }

      packages[packageId] = serverPackage
      Logger.info(`Loaded package: ${packageId} v${manifest.version}`)

    } catch (error) {
      Logger.error(`Failed to load package ${packageId}:`, error)
      // Continue loading other packages
    }
  }

  return packages
}

export function loadClientPackages(): Record<string, ClientStylePackage> {
  // Similar implementation for client-side
  // Uses require.context in Next.js or dynamic imports
}
```

**Benefits**:
- No manual imports required
- Graceful error handling (bad packages don't crash system)
- Feature flag support maintained
- Detailed logging for debugging
- Validates package interface before loading

---

### Solution 3: Base Package Class

**Create**: `src/domain/style/packages/base/BaseServerPackage.ts`

**Purpose**: Abstract away common boilerplate that every package needs

**Implementation**:
```typescript
export abstract class BaseServerPackage implements ServerStylePackage {
  abstract id: string
  abstract clientConfig: ClientStylePackage

  // Optional: Packages can override these
  protected workflowVersion: 'v2' | 'v3' = 'v3'

  // Template method pattern - child classes only implement specific parts
  async buildGenerationPayload(context: GenerationContext): Promise<GenerationPayload> {
    // Handle all boilerplate
    const settings = this.mergeSettings(context)
    const aspectRatio = this.resolveAspectRatio(settings)
    const referenceImages = await this.buildReferenceImages(context)

    // Call abstract methods that child must implement
    const prompt = await this.buildPrompt(settings, context)
    const rules = await this.buildRules(settings, context)

    return {
      prompt,
      rules,
      referenceImages,
      aspectRatio,
      resolution: settings.resolution
    }
  }

  // Implemented boilerplate methods (packages inherit these)
  private mergeSettings(context: GenerationContext): PhotoStyleSettings {
    // Three-tier merge logic (package defaults → preset → user settings)
    const packageDefaults = this.clientConfig.defaultSettings
    const presetSettings = this.resolvePreset(context.styleSettings)
    return mergePhotoStyleSettings(packageDefaults, presetSettings, context.styleSettings)
  }

  private resolveAspectRatio(settings: PhotoStyleSettings): string {
    return resolveAspectRatioConfig(settings.aspectRatio).id
  }

  protected async buildReferenceImages(context: GenerationContext): Promise<ReferenceImage[]> {
    // Default implementation - packages can override
    const selfieComposite = await this.buildSelfieComposite(context.selfieS3Keys)
    return [selfieComposite]
  }

  // Abstract methods that child packages MUST implement
  protected abstract buildPrompt(
    settings: PhotoStyleSettings,
    context: GenerationContext
  ): Promise<string | Record<string, unknown>>

  protected abstract buildRules(
    settings: PhotoStyleSettings,
    context: GenerationContext
  ): Promise<{ mustFollow: string[]; freedom: string[] }>
}
```

**Usage** (in package):
```typescript
// src/domain/style/packages/outfit1/server.ts
import { BaseServerPackage } from '../base/BaseServerPackage'
import { outfit1 } from './index'

export class Outfit1ServerPackage extends BaseServerPackage {
  id = 'outfit1'
  clientConfig = outfit1
  workflowVersion = 'v3'

  // Only implement package-specific logic
  protected async buildPrompt(settings: PhotoStyleSettings, context: GenerationContext) {
    return {
      subject: this.buildSubject(settings),
      scene: this.buildScene(settings),
      camera: this.buildCamera(settings),
      lighting: this.buildLighting(settings)
    }
  }

  protected async buildRules(settings: PhotoStyleSettings, context: GenerationContext) {
    return {
      mustFollow: [
        'Professional corporate photography style',
        'Person is the primary subject'
      ],
      freedom: [
        'Adjust lighting for natural look',
        'Fine-tune composition within shot type constraints'
      ]
    }
  }

  // Override reference images to add garment collage
  protected async buildReferenceImages(context: GenerationContext): Promise<ReferenceImage[]> {
    const baseImages = await super.buildReferenceImages(context)

    if (context.styleSettings.customClothing?.assetId) {
      const garmentCollage = await this.buildGarmentCollage(context)
      baseImages.push(garmentCollage)
    }

    return baseImages
  }
}

export const outfit1Server = new Outfit1ServerPackage()
export default outfit1Server
```

**Benefits**:
- Eliminates 50+ lines of boilerplate per package
- Enforces consistent patterns
- Packages focus only on unique logic
- Template method pattern makes extension points clear
- Easier to test (can test base class separately)

---

### Solution 4: Workflow Plugin System

**Create**: `src/queue/workers/workflows/registry.ts`

**Problem**: Hard-coded if-else for workflow versions in generateImage.ts

**Solution**: Registry of workflow handlers

```typescript
export interface WorkflowHandler {
  version: string
  execute: (context: WorkflowContext) => Promise<GenerationResult>
  setup?: (context: WorkflowContext) => Promise<void>  // Optional pre-processing
}

const workflowRegistry = new Map<string, WorkflowHandler>()

export function registerWorkflow(handler: WorkflowHandler) {
  workflowRegistry.set(handler.version, handler)
  Logger.info(`Registered workflow: ${handler.version}`)
}

export function getWorkflow(version: string): WorkflowHandler | undefined {
  return workflowRegistry.get(version)
}

// Auto-register built-in workflows
registerWorkflow({
  version: 'v3',
  setup: async (ctx) => {
    // V3-specific setup (selfie composites, intermediate storage)
  },
  execute: executeV3Workflow
})

registerWorkflow({
  version: 'v2',
  execute: executeV2Workflow
})
```

**Usage** (in generateImage.ts):
```typescript
// BEFORE (hard-coded)
if (workflowVersion === 'v3') {
  // V3 setup
  result = await executeV3Workflow(...)
} else if (workflowVersion === 'v2') {
  // V2 setup
  result = await executeV2Workflow(...)
}

// AFTER (registry-based)
const workflow = getWorkflow(workflowVersion)
if (!workflow) {
  throw new Error(`Unknown workflow version: ${workflowVersion}`)
}

if (workflow.setup) {
  await workflow.setup(context)
}

result = await workflow.execute(context)
```

**Adding Custom Workflow** (packages can register their own):
```typescript
// src/domain/style/packages/my-package/workflow.ts
import { registerWorkflow } from '@/queue/workers/workflows/registry'

registerWorkflow({
  version: 'my-custom-workflow',
  execute: async (context) => {
    // Custom workflow implementation
    // Can reuse existing steps or define new ones
  }
})
```

**Benefits**:
- No modification to worker code for new workflows
- Packages can define custom workflows
- Clear workflow lifecycle (setup → execute)
- Workflows can be loaded from packages automatically

---

### Solution 5: Element-Level Prompt Composition

**Problem**: Current packages build entire prompts as monolithic blocks. This creates tight coupling between prompt concerns (branding, clothing, background, camera settings, etc.) and makes it difficult to:
- Reuse prompt logic across packages
- Add new style elements without modifying existing packages
- Compose prompts from independent, reusable pieces
- Control which element contributes to which workflow phase

**Current Architecture (Monolithic)**:
```
Package (outfit1)
  └─ buildPrompt()
       ├─ Person description (clothing, pose, expression)
       ├─ Background rules (style, branding, logo)
       ├─ Camera settings (angle, shot type, framing)
       ├─ Lighting rules (style, direction, mood)
       └─ Branding rules (colors, logo positioning)

Problem: All concerns mixed together, no reusability
```

**Proposed Architecture (Compositional)**:
```
Workflow (Step 1a: Person Generation)
  └─ Ask all elements: "What should I include in person generation prompt?"
       ├─ ShotTypeElement → "Frame as medium-shot, waist-up"
       ├─ CustomClothingElement → "Wear items from garment collage"
       ├─ LightingElement → "Soft directional lighting"
       └─ BrandingElement → (skip, not relevant for person generation)

Result: Composed prompt from only relevant elements
```

**Example of Current Problem**:
```typescript
// Package builds entire prompt - tightly couples all concerns
protected async buildPrompt(settings: PhotoStyleSettings, context: GenerationContext) {
  return {
    subject: `Person wearing ${settings.customClothing?.description}...`,
    scene: `${settings.background.style} background with ${settings.branding?.colors}...`,
    camera: `${settings.camera.angle} shot...`,
    // Branding, clothing, background all mixed together
    // Must duplicate this logic in EVERY package
  }
}
```

If you want to change how branding works, you must modify every package.

**With Element System**:
```typescript
// Branding element contributes its own rules (once, reused everywhere)
export class BrandingElement extends StyleElement {
  contribute(context: ElementContext) {
    if (context.phase === 'background-generation') {
      return {
        instructions: ['Include logo in background'],
        mustFollow: ['Logo must be visible but not dominant']
      }
    }
    if (context.phase === 'person-generation') {
      return {} // Not relevant, skip
    }
  }
}
```

Change branding logic once, all packages automatically get the update.

---

#### Element Interface

**Create**: `src/domain/style/elements/base/StyleElement.ts`

Elements are self-contained, composable pieces that contribute prompt instructions at specific workflow phases.

```typescript
export type WorkflowPhase =
  | 'background-generation'  // Step 1b: Generate background
  | 'person-generation'      // Step 1a: Generate person
  | 'composition'            // Step 2: Compose person + background
  | 'evaluation'             // Step 3: Evaluate result

export interface ElementContribution {
  // Prompt instructions to add
  instructions?: string[]

  // Rules that must be followed
  mustFollow?: string[]

  // Creative freedom allowed
  freedom?: string[]

  // Reference images to include
  referenceImages?: ReferenceImage[]

  // Structured data for the AI model
  metadata?: Record<string, unknown>
}

export interface ElementContext {
  // Current workflow phase
  phase: WorkflowPhase

  // All user settings
  settings: PhotoStyleSettings

  // Generation context (selfies, user data, etc.)
  generationContext: GenerationContext

  // Results from previous phases (if available)
  previousPhaseResults?: {
    backgroundImage?: string
    personImage?: string
    intermediateImages?: string[]
  }

  // Other elements' contributions so far
  existingContributions: ElementContribution[]
}

export abstract class StyleElement {
  abstract id: string
  abstract name: string
  abstract description: string

  /**
   * Determine if this element is relevant for the given phase
   * Return false to skip contribution
   */
  abstract isRelevantForPhase(context: ElementContext): boolean

  /**
   * Contribute prompt instructions for this phase
   * Only called if isRelevantForPhase returns true
   */
  abstract contribute(context: ElementContext): Promise<ElementContribution>

  /**
   * Optional: Validate settings before generation
   * Return error messages if settings are invalid
   */
  validate?(settings: PhotoStyleSettings): string[] {
    return []
  }

  /**
   * Optional: Priority for ordering contributions (lower = earlier)
   * Default: 100
   */
  get priority(): number {
    return 100
  }
}
```

---

#### Example Element: Branding

**Create**: `src/domain/style/elements/branding/BrandingElement.ts`

```typescript
import { StyleElement, ElementContext, ElementContribution } from '../base/StyleElement'

export class BrandingElement extends StyleElement {
  id = 'branding'
  name = 'Branding'
  description = 'Adds logo and brand color preservation rules'

  // Branding only affects backgrounds and composition, not person generation
  isRelevantForPhase(context: ElementContext): boolean {
    const { phase, settings } = context

    // Skip if no branding configured
    if (!settings.branding?.logoS3Key && !settings.branding?.colors) {
      return false
    }

    // Only contribute to background and composition phases
    return phase === 'background-generation' || phase === 'composition'
  }

  async contribute(context: ElementContext): Promise<ElementContribution> {
    const { phase, settings } = context
    const branding = settings.branding!

    if (phase === 'background-generation') {
      return {
        instructions: [
          `Include company logo in the background`,
          branding.colors ? `Use brand colors: ${branding.colors.join(', ')}` : undefined
        ].filter(Boolean) as string[],

        mustFollow: [
          'Logo must be clearly visible but not dominant',
          'Brand colors must be accurate and prominent'
        ],

        referenceImages: branding.logoS3Key ? [{
          url: await this.getLogoUrl(branding.logoS3Key),
          description: 'Company logo - must be included in background exactly as shown'
        }] : [],

        metadata: {
          brandColors: branding.colors,
          logoPosition: branding.position || 'background'
        }
      }
    }

    if (phase === 'composition') {
      return {
        mustFollow: [
          'Preserve logo from background image exactly as it appears',
          'Do not regenerate, redraw, or modify the logo',
          'Maintain brand color accuracy from background'
        ],

        freedom: [
          'Adjust logo brightness/contrast to match lighting if needed'
        ]
      }
    }

    return {}
  }

  private async getLogoUrl(s3Key: string): Promise<string> {
    // Implementation to get signed URL
    return `https://.../${s3Key}`
  }
}
```

---

#### Example Element: Custom Clothing

**Create**: `src/domain/style/elements/clothing/CustomClothingElement.ts`

```typescript
export class CustomClothingElement extends StyleElement {
  id = 'custom-clothing'
  name = 'Custom Clothing'
  description = 'Adds custom outfit reference and color matching rules'

  // Clothing only affects person generation, not backgrounds
  isRelevantForPhase(context: ElementContext): boolean {
    const { phase, settings } = context

    if (!settings.customClothing?.assetId) {
      return false
    }

    // Only contribute to person generation
    return phase === 'person-generation'
  }

  async contribute(context: ElementContext): Promise<ElementContribution> {
    const { settings } = context
    const clothing = settings.customClothing!

    // Get the garment collage reference image
    const garmentCollage = await this.buildGarmentCollage(clothing)

    return {
      instructions: [
        'Person must wear the exact clothing items shown in the garment collage reference',
        'Match all visible clothing details: style, fit, patterns, textures'
      ],

      mustFollow: [
        'All garments from collage must be present and visible',
        'Clothing must fit naturally on the person',
        'No duplicate accessories (only include items from collage once)'
      ],

      referenceImages: [garmentCollage],

      metadata: {
        clothingColors: clothing.colors,
        garmentTypes: clothing.items?.map(i => i.type),
        userAdjustedColors: clothing.colors // For AI to reference in JSON format
      }
    }
  }

  validate(settings: PhotoStyleSettings): string[] {
    const errors: string[] = []
    const clothing = settings.customClothing

    if (clothing?.assetId && !clothing.items?.length) {
      errors.push('Custom clothing requires at least one garment item')
    }

    return errors
  }

  // High priority - clothing should be considered before accessories
  get priority(): number {
    return 50
  }
}
```

---

#### Example Element: Shot Type

**Create**: `src/domain/style/elements/camera/ShotTypeElement.ts`

```typescript
export class ShotTypeElement extends StyleElement {
  id = 'shot-type'
  name = 'Shot Type'
  description = 'Controls framing and composition based on shot type'

  // Shot type affects all phases
  isRelevantForPhase(context: ElementContext): boolean {
    return true
  }

  async contribute(context: ElementContext): Promise<ElementContribution> {
    const { phase, settings } = context
    const shotType = settings.camera?.shotType || 'medium-shot'

    const framingRules = this.getFramingRules(shotType)

    if (phase === 'person-generation') {
      return {
        instructions: [
          `Frame person as ${shotType}`,
          framingRules.description
        ],

        mustFollow: [
          `Person must fill frame according to ${shotType} framing`,
          framingRules.mustShow,
          framingRules.mustNotShow
        ],

        metadata: {
          shotType,
          framingTolerance: framingRules.tolerance
        }
      }
    }

    if (phase === 'composition') {
      return {
        mustFollow: [
          `Maintain ${shotType} framing from person image`,
          'Do not reframe or crop the person'
        ]
      }
    }

    if (phase === 'evaluation') {
      return {
        metadata: {
          expectedFraming: framingRules.bounds,
          tolerance: framingRules.tolerance
        }
      }
    }

    return {}
  }

  private getFramingRules(shotType: string) {
    const rules = {
      'close-up': {
        description: 'Shoulders and head visible, face is primary focus',
        mustShow: 'Full head and shoulders',
        mustNotShow: 'Below mid-chest',
        bounds: { minY: 0.15, maxY: 0.85 },
        tolerance: 0.10
      },
      'medium-shot': {
        description: 'Waist-up framing, upper body and face clearly visible',
        mustShow: 'Head to waist',
        mustNotShow: 'Below waist or full legs',
        bounds: { minY: 0.10, maxY: 0.90 },
        tolerance: 0.15
      },
      'full-body': {
        description: 'Entire body from head to feet visible',
        mustShow: 'Complete body including feet',
        mustNotShow: 'Cropped limbs',
        bounds: { minY: 0.05, maxY: 0.95 },
        tolerance: 0.05
      }
    }

    return rules[shotType] || rules['medium-shot']
  }
}
```

---

#### Element Registry and Composition Engine

**Create**: `src/domain/style/elements/registry.ts`

```typescript
import { StyleElement, ElementContext, ElementContribution } from './base/StyleElement'

class ElementRegistry {
  private elements = new Map<string, StyleElement>()

  register(element: StyleElement): void {
    if (this.elements.has(element.id)) {
      throw new Error(`Element ${element.id} already registered`)
    }
    this.elements.set(element.id, element)
    Logger.info(`Registered style element: ${element.id}`)
  }

  get(id: string): StyleElement | undefined {
    return this.elements.get(id)
  }

  getAll(): StyleElement[] {
    return Array.from(this.elements.values())
  }

  /**
   * Compose prompt contributions from all relevant elements for a given phase
   */
  async composeContributions(context: ElementContext): Promise<ElementContribution> {
    const relevantElements = this.elements.values()
      .filter(element => element.isRelevantForPhase(context))
      .sort((a, b) => a.priority - b.priority)

    const allInstructions: string[] = []
    const allMustFollow: string[] = []
    const allFreedom: string[] = []
    const allReferenceImages: ReferenceImage[] = []
    const allMetadata: Record<string, unknown> = {}

    for (const element of relevantElements) {
      try {
        const contribution = await element.contribute(context)

        if (contribution.instructions) {
          allInstructions.push(...contribution.instructions)
        }

        if (contribution.mustFollow) {
          allMustFollow.push(...contribution.mustFollow)
        }

        if (contribution.freedom) {
          allFreedom.push(...contribution.freedom)
        }

        if (contribution.referenceImages) {
          allReferenceImages.push(...contribution.referenceImages)
        }

        if (contribution.metadata) {
          // Namespace metadata by element ID to avoid conflicts
          allMetadata[element.id] = contribution.metadata
        }

        // Update context with cumulative contributions for next element
        context.existingContributions.push(contribution)

      } catch (error) {
        Logger.error(`Element ${element.id} failed to contribute:`, error)
        // Continue with other elements
      }
    }

    return {
      instructions: allInstructions,
      mustFollow: allMustFollow,
      freedom: allFreedom,
      referenceImages: allReferenceImages,
      metadata: allMetadata
    }
  }

  /**
   * Validate all element settings before generation
   */
  validateSettings(settings: PhotoStyleSettings): ValidationResult {
    const errors: string[] = []

    for (const element of this.elements.values()) {
      if (element.validate) {
        const elementErrors = element.validate(settings)
        errors.push(...elementErrors)
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
}

export const elementRegistry = new ElementRegistry()

// Auto-register core elements
import { BrandingElement } from './branding/BrandingElement'
import { CustomClothingElement } from './clothing/CustomClothingElement'
import { ShotTypeElement } from './camera/ShotTypeElement'
// ... more elements

elementRegistry.register(new BrandingElement())
elementRegistry.register(new CustomClothingElement())
elementRegistry.register(new ShotTypeElement())
```

---

#### Integration with Workflow

**Modify**: `src/queue/workers/generate-image/steps/v3-step1a-person-generation.ts`

```typescript
import { elementRegistry } from '@/domain/style/elements/registry'

export async function executeV3Step1a(context: WorkflowContext): Promise<Step1aResult> {
  // Create element context for this phase
  const elementContext: ElementContext = {
    phase: 'person-generation',
    settings: context.styleSettings,
    generationContext: context.generationContext,
    existingContributions: []
  }

  // Compose contributions from all relevant elements
  const contributions = await elementRegistry.composeContributions(elementContext)

  // Build base prompt
  const basePrompt = {
    subject: 'Professional photograph of person',
    technical: 'High resolution, professional photography'
  }

  // Add element instructions to prompt
  const fullPrompt = {
    ...basePrompt,
    instructions: contributions.instructions,
    rules: {
      mustFollow: contributions.mustFollow,
      freedom: contributions.freedom
    }
  }

  // Merge element reference images with base references
  const referenceImages = [
    ...context.baseReferenceImages,  // Selfie composite
    ...contributions.referenceImages  // Element-contributed images
  ]

  // Pass element metadata to AI model
  const metadata = contributions.metadata

  // Execute generation with composed prompt
  const result = await generateImage({
    prompt: fullPrompt,
    referenceImages,
    metadata
  })

  return result
}
```

---

#### Integration with Packages

Packages no longer build monolithic prompts. Instead, they configure which elements are active:

```typescript
// src/domain/style/packages/outfit1/server.ts
export class Outfit1ServerPackage extends BaseServerPackage {
  id = 'outfit1'
  clientConfig = outfit1

  // Declare which elements this package uses
  protected getActiveElements(): string[] {
    return [
      'shot-type',
      'custom-clothing',  // Outfit1 uses custom clothing
      'branding',
      'lighting',
      'background',
      // Camera angle, etc. are handled by base elements
    ]
  }

  // Only implement package-specific logic that doesn't fit element model
  protected async buildAdditionalContext(context: GenerationContext) {
    // Any package-specific context preparation
    return {
      outfitTransferMode: true,
      // ... package-specific data
    }
  }
}
```

---

#### Element Auto-Discovery

Just like packages, elements can be auto-discovered:

**Create**: `src/domain/style/elements/[element-id]/element.json`

```json
{
  "id": "branding",
  "version": "1.0.0",
  "name": "Branding",
  "description": "Logo and brand color management",
  "phases": ["background-generation", "composition"],
  "priority": 100,
  "entry": "./BrandingElement.ts"
}
```

**Create**: `src/domain/style/elements/loader.ts`

```typescript
export async function loadElements(): Promise<void> {
  const elementsDir = path.join(__dirname, './')
  const elementDirs = fs.readdirSync(elementsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())

  for (const dir of elementDirs) {
    try {
      const manifestPath = path.join(elementsDir, dir.name, 'element.json')
      if (!fs.existsSync(manifestPath)) continue

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
      const elementPath = path.join(elementsDir, dir.name, manifest.entry)
      const elementModule = await import(elementPath)
      const element = elementModule.default || elementModule[manifest.id]

      elementRegistry.register(element)
      Logger.info(`Loaded element: ${manifest.id} v${manifest.version}`)
    } catch (error) {
      Logger.error(`Failed to load element ${dir.name}:`, error)
    }
  }
}
```

---

### Benefits of Element-Level Composition

**1. True Separation of Concerns**
- Each element owns its domain (branding, clothing, camera, etc.)
- No cross-contamination between concerns
- Easy to reason about and test in isolation

**2. Reusability Across Packages**
- Write branding logic once, works in all packages
- New packages automatically get all element behaviors
- No code duplication

**3. Composability**
- Mix and match elements freely
- Add new elements without touching existing code
- Packages declare which elements they use

**4. Phase-Aware Contributions**
- Elements know which workflow phases they affect
- Prevents irrelevant instructions (e.g., clothing rules in background generation)
- Optimizes prompt clarity and AI comprehension

**5. Extensibility**
- Third-party elements can be added via plugins
- Custom elements for specific use cases
- Element marketplace potential

**6. Maintainability**
- Bug fixes localized to single element
- Easy to trace which element added which instruction
- Clear ownership and responsibility

**Example: Adding a New Element**

```bash
# Create element directory
mkdir -p src/domain/style/elements/pose

# Create manifest
cat > src/domain/style/elements/pose/element.json << EOF
{
  "id": "pose",
  "version": "1.0.0",
  "name": "Pose Control",
  "description": "Manages person pose and body language",
  "phases": ["person-generation"],
  "priority": 75
}
EOF

# Implement element
cat > src/domain/style/elements/pose/PoseElement.ts << EOF
export class PoseElement extends StyleElement {
  id = 'pose'

  isRelevantForPhase(context: ElementContext) {
    return context.phase === 'person-generation'
      && context.settings.pose?.style
  }

  async contribute(context: ElementContext) {
    return {
      instructions: [
        \`Person should be \${context.settings.pose.style}\`,
        'Natural, professional body language'
      ],
      mustFollow: ['Pose appropriate for professional context']
    }
  }
}

export default new PoseElement()
EOF

# Restart server - element auto-discovered and available to all packages
```

---

## Migration Path

### Phase 1: Add Package Manifest (No Breaking Changes)

1. Add `package.json` to each existing package directory
2. Keep existing `server.ts` and `index.ts` registration
3. Add loader alongside existing system
4. Validate that loader discovers all packages correctly

**Risk**: Low - purely additive

---

### Phase 2: Implement Base Package Class (Opt-In)

1. Create `BaseServerPackage` abstract class
2. Migrate one package (e.g., `headshot1`) to use it
3. Test thoroughly in production
4. Migrate remaining packages one by one
5. Keep old pattern working for backward compatibility

**Risk**: Medium - changes package implementations but doesn't break registration

---

### Phase 3: Switch to Auto-Discovery (Feature Flag)

1. Add feature flag `ENABLE_PACKAGE_AUTO_DISCOVERY`
2. When enabled, use loader instead of manual registry
3. Test in staging with flag enabled
4. Monitor for issues
5. Enable in production
6. After stable period, remove manual registry code

**Risk**: Medium - changes loading mechanism but packages unchanged

---

### Phase 4: Implement Workflow Registry (Parallel)

1. Create workflow registry
2. Register v2 and v3 workflows
3. Add feature flag `ENABLE_WORKFLOW_REGISTRY`
4. When enabled, use registry instead of if-else
5. Test thoroughly
6. Enable in production
7. Remove if-else code after stable period

**Risk**: Medium - changes execution path but behavior identical

---

### Phase 5: Implement Element System (Parallel to Phase 2-4)

1. Create `StyleElement` abstract class and interfaces
2. Create `ElementRegistry` with composition engine
3. Implement 3-5 core elements (branding, clothing, shot type)
4. Add element integration points in workflow steps
5. Add feature flag `ENABLE_ELEMENT_COMPOSITION`
6. Run parallel A/B test: old monolithic prompts vs element-composed prompts
7. Compare output quality metrics
8. Gradually migrate packages to use element composition
9. Enable element composition for all packages
10. Remove old monolithic prompt building code

**Risk**: Medium-High - changes prompt building fundamentally, requires quality validation

**Validation Strategy**:
- Generate same inputs with both systems, compare outputs
- Measure success rates, evaluation pass rates, user satisfaction
- Start with one package, expand gradually
- Keep rollback capability for at least 2 weeks after launch

---

### Phase 6: Element Auto-Discovery (After Element System Stable)

1. Create element manifest specification
2. Implement element loader
3. Add feature flag `ENABLE_ELEMENT_AUTO_DISCOVERY`
4. Test in staging
5. Enable in production
6. Remove manual element registration

**Risk**: Low - purely changes loading mechanism, elements unchanged

---

## Example: Adding a New Package (After Migration)

### Current Process (5+ steps, 30+ minutes)

1. Create package directory: `src/domain/style/packages/my-package/`
2. Create `index.ts` with client config (50 lines of boilerplate)
3. Create `server.ts` with `buildGenerationPayload` (80 lines of boilerplate)
4. Add import to `src/domain/style/packages/server.ts`
5. Add import to `src/domain/style/packages/index.ts`
6. Add to both registries
7. Add feature flag checks if needed
8. Test, rebuild, redeploy
9. Debug registration issues
10. Debug boilerplate mistakes

**Total Time**: 30-60 minutes for experienced developer

---

### Proposed Process (2 steps, 5 minutes)

1. **Create package directory with manifest**:

```bash
mkdir -p src/domain/style/packages/my-package
```

```json
// src/domain/style/packages/my-package/package.json
{
  "id": "my-package",
  "version": "1.0.0",
  "name": "My Package",
  "description": "Custom style package",
  "client": {
    "label": "My Style",
    "visibleCategories": ["background", "camera"],
    "defaultSettings": { ... }
  },
  "server": {
    "workflowVersion": "v3"
  },
  "entry": {
    "client": "./index.ts",
    "server": "./server.ts"
  }
}
```

2. **Implement package-specific logic** (no boilerplate):

```typescript
// src/domain/style/packages/my-package/server.ts
import { BaseServerPackage } from '../base/BaseServerPackage'
import { myPackage } from './index'

class MyPackageServer extends BaseServerPackage {
  id = 'my-package'
  clientConfig = myPackage

  protected async buildPrompt(settings, context) {
    return {
      subject: { /* package-specific */ },
      scene: { /* package-specific */ }
    }
  }

  protected async buildRules(settings, context) {
    return {
      mustFollow: ['My custom rules'],
      freedom: ['My freedoms']
    }
  }
}

export default new MyPackageServer()
```

3. **Restart server** - Package auto-discovered and available

**Total Time**: 5-10 minutes

---

## Benefits Summary

### For Package Developers

- **90% less boilerplate** - Focus on unique logic, inherit common patterns
- **Clear contract** - BaseServerPackage shows exactly what to implement
- **Self-documenting** - Manifest declares capabilities
- **Fast iteration** - No rebuild/redeploy for testing during development

### For System Maintainers

- **Zero-touch deployment** - Add packages without changing existing code
- **Better separation of concerns** - Packages completely independent
- **Easier testing** - Can test packages in isolation
- **Graceful degradation** - Bad packages logged and skipped, don't crash system

### For the Platform

- **Open for extension** - New packages without modification
- **Closed for modification** - Core worker unchanged
- **Scalable** - Can have 100+ packages without registry bloat
- **Maintainable** - Changes localized to affected packages

---

## Implementation Checklist

### Phase 1: Foundation (Week 1)
- [ ] Create package manifest specification
- [ ] Implement package loader with auto-discovery
- [ ] Add validation for package manifests
- [ ] Add detailed logging for package loading
- [ ] Create developer documentation

### Phase 2: Base Class (Week 2-3)
- [ ] Design BaseServerPackage abstract class
- [ ] Implement template methods for common patterns
- [ ] Migrate headshot1 package as proof of concept
- [ ] Test migrated package in staging
- [ ] Migrate remaining packages

### Phase 3: Element System Foundation (Week 3-4)
- [ ] Design StyleElement abstract class and interfaces
- [ ] Implement ElementRegistry and composition engine
- [ ] Create element manifest specification
- [ ] Implement element loader with auto-discovery
- [ ] Add element validation and error handling

### Phase 4: Core Elements (Week 4-5)
- [ ] Implement BrandingElement
- [ ] Implement CustomClothingElement
- [ ] Implement ShotTypeElement
- [ ] Implement BackgroundElement
- [ ] Implement LightingElement
- [ ] Implement CameraElement
- [ ] Test each element in isolation

### Phase 5: Workflow Integration (Week 5-6)
- [ ] Integrate element composition into Step 1a (person generation)
- [ ] Integrate element composition into Step 1b (background generation)
- [ ] Integrate element composition into Step 2 (composition)
- [ ] Integrate element composition into Step 3 (evaluation)
- [ ] Add feature flag for element-based prompt building
- [ ] Test workflow integration in staging

### Phase 6: Package Migration to Elements (Week 6-7)
- [ ] Migrate outfit1 package to use element composition
- [ ] Migrate headshot1 package to use element composition
- [ ] Compare output quality before/after migration
- [ ] Test in production with A/B testing
- [ ] Migrate remaining packages

### Phase 7: Auto-Discovery (Week 7-8)
- [ ] Add feature flag for package auto-discovery
- [ ] Test in staging environment
- [ ] Monitor production rollout
- [ ] Remove manual registration code

### Phase 8: Workflow Registry (Week 8-9)
- [ ] Design workflow handler interface
- [ ] Implement workflow registry
- [ ] Register existing workflows (v2, v3)
- [ ] Add feature flag for registry usage
- [ ] Test and deploy
- [ ] Remove if-else workflow routing

### Phase 9: Documentation (Ongoing)
- [ ] Write package development guide
- [ ] Write element development guide
- [ ] Create example packages and elements
- [ ] Document migration for existing packages
- [ ] Add troubleshooting guide
- [ ] Create video tutorials for element creation

---

## Risk Assessment

### Low Risk
- Adding package manifests (purely additive)
- Creating base package class (opt-in migration)
- Documentation and examples

### Medium Risk
- Switching to auto-discovery (changes loading mechanism)
- Workflow registry (changes execution path)
- Migrating existing packages (behavior must stay identical)

### Mitigation Strategies
1. **Feature flags** for all changes - rollback instantly if issues
2. **Parallel systems** - run old and new side-by-side during migration
3. **Extensive testing** - unit tests, integration tests, staging validation
4. **Gradual rollout** - one package at a time, one workflow at a time
5. **Monitoring** - detailed logging and alerts during migration

---

## Conclusion

This proposal transforms the system at two levels:

**Package Level**: From **manual registration with high boilerplate** to **auto-discovery with minimal code**
**Element Level**: From **monolithic prompt building** to **composable, phase-aware prompt contributions**

The migration is designed to be gradual, safe, and backward compatible.

**Key Metrics**:
- **Package boilerplate reduction**: 90% (from ~130 lines to ~15 lines per package)
- **Element reusability**: 100% (write once, use in all packages)
- **Time to add package**: 85% faster (from 30-60 min to 5-10 min)
- **Time to add element**: New capability (previously impossible without modifying every package)
- **Coupling**: Eliminated at both package and element levels
- **Maintainability**: Dramatically improved (changes localized to single element or package)
- **Prompt clarity**: Improved (elements only contribute to relevant phases)

**Next Steps**:
1. Review and approve this proposal
2. Create detailed implementation tasks
3. Start Phase 1 (Foundation)
4. Iterate based on feedback
