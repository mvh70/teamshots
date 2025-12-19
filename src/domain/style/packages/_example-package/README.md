# Example Third-Party Package

This is a complete example demonstrating how to create a custom style package for TeamShots.

## Quick Start

### 1. Copy This Template

```bash
cp -r src/domain/style/packages/_example-package src/domain/style/packages/my-package
cd src/domain/style/packages/my-package
```

### 2. Customize the Package

Edit `package.ts` and update:
- Package ID (must be unique)
- Package metadata (author, description, etc.)
- Default settings
- Visible categories
- `buildGenerationPayload` logic

### 3. Import Your Package

```typescript
// In src/domain/style/packages/server.ts or anywhere server-side
import './my-package/package'  // Auto-registers!
```

### 4. Test Your Package

```bash
npm run build
npm run dev
```

Your package is now available in the system!

## Package Structure

```
my-package/
├── package.ts          # Main package definition (required)
├── README.md          # Documentation
├── elements/          # Custom elements (optional)
│   └── MyElement.ts
├── utils/             # Helper functions (optional)
│   └── helpers.ts
└── tests/             # Package tests (optional)
    └── package.test.ts
```

## Key Concepts

### 1. Package Configuration

The package configuration defines:
- **Metadata**: Author, version, description, capabilities
- **UI**: Visible categories, default settings
- **Generation**: How to build prompts for AI
- **Lifecycle**: Initialization, validation, cleanup hooks

### 2. Elements

Elements are modular units that contribute to prompt generation:
- Each element handles one aspect (pose, lighting, etc.)
- Elements can be provided by packages
- Elements execute in priority order
- See `CustomEffectElement` in `package.ts` for example

### 3. Lifecycle Hooks

```typescript
{
  // One-time setup
  async initialize() { },

  // Pre-registration validation
  async validate() { },

  // Post-registration callback
  onRegister() { },

  // Pre-unregistration cleanup
  onUnregister() { }
}
```

### 4. Asset Preparation

```typescript
{
  // Prepare assets before generation
  async prepareAssets(context) {
    // Download/transform assets
    return {
      'asset-key': {
        base64: '...',
        mimeType: 'image/png'
      }
    }
  }
}
```

## Advanced Features

### Custom Elements

Create elements that add functionality:

```typescript
class MyElement extends StyleElement {
  readonly id = 'my-element'
  readonly name = 'My Element'

  get priority(): number {
    return 80  // After core elements
  }

  isRelevantForPhase(context: ElementContext): boolean {
    return context.phase === 'person-generation'
  }

  async contribute(context: ElementContext): Promise<ElementContribution> {
    return {
      instructions: ['My instruction'],
      mustFollow: ['My rule'],
      metadata: { myData: 'value' }
    }
  }

  validate(settings: PhotoStyleSettings): string[] {
    return []  // No errors
  }
}
```

### Package Dependencies

Declare dependencies on other packages:

```typescript
metadata: {
  compatibility: {
    requires: ['headshot1'],  // Must be installed
    optional: ['outfit1']      // Enhances if available
  }
}
```

### Feature Flags

Control package availability:

```typescript
{
  featureFlag: 'myPackage',  // Only load if flag enabled
}
```

Then in `.env`:
```
FEATURE_MY_PACKAGE=true
```

## Testing

### Unit Tests

```typescript
import { testPackage } from '../testing'
import { myPackage } from './package'

describe('My Package', () => {
  it('should build valid payload', async () => {
    const payload = await myPackage.buildGenerationPayload({
      generationId: 'test',
      styleSettings: { ... },
      selfieKeys: ['key1'],
      processedSelfies: { ... }
    })

    expect(payload.prompt).toBeDefined()
    expect(payload.mustFollowRules).toHaveLength(3)
  })
})
```

### Integration Tests

Test your package with real workflow:

```bash
# Set test data
export TEST_PACKAGE_ID=my-package

# Run generation
npm run test:e2e
```

## Publishing

### As Internal Package

1. Commit to your repo
2. Others import via `import './my-package/package'`

### As NPM Package

1. Create `package.json`:
```json
{
  "name": "@your-org/teamshots-my-package",
  "version": "1.0.0",
  "main": "dist/package.js",
  "peerDependencies": {
    "@teamshots/core": "^1.0.0"
  }
}
```

2. Publish:
```bash
npm publish
```

3. Install:
```bash
npm install @your-org/teamshots-my-package
```

4. Import:
```typescript
import '@your-org/teamshots-my-package'
```

## FAQ

### Q: Do I need to modify core files?

**A: No!** Packages self-register on import. Just import your package file.

### Q: Can I override existing packages?

**A: Yes.** Use `packageRegistry.register(myPackage, { force: true })`.

### Q: How do I debug my package?

**A: Use Logger:**
```typescript
import { Logger } from '@/lib/logger'

Logger.info('[MyPackage] Debug message', { data })
```

### Q: Can packages share elements?

**A: Yes.** Elements are global. Multiple packages can use the same element.

### Q: What if my package fails validation?

**A: Check logs:**
```typescript
const result = await packageRegistry.register(myPackage)
if (!result.valid) {
  console.error('Validation failed:', result.errors)
}
```

## Support

- Read: `PLUGIN_DEVELOPMENT_GUIDE.md`
- Review: `ARCHITECTURE_REVIEW.md`
- Examples: See `headshot1/`, `outfit1/`
- Issues: GitHub Issues

## License

Your package, your license!
