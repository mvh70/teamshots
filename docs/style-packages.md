# Style Packages

Comprehensive contract and workflow for style packages that drive generation.

## Package Responsibilities

Each package exports a `ClientStylePackage` and a matching server variant. The client config powers UI defaults and serialization, while the server variant plugs into the worker via `buildGenerationPayload`.

### Required properties

- `id`, `label`, `version`
- `visibleCategories`: controls which `PhotoStyleSettings` fields appear in the UI.
- `availableBackgrounds`: optional list of preset background IDs.
- `defaultSettings`: baseline `PhotoStyleSettings`, now including camera and pose fields (`presetId`, `focalLength`, `aperture`, `lightingQuality`, `shutterSpeed`, `bodyAngle`, `headPosition`, `shoulderPosition`, `weightDistribution`, `armPosition`, `sittingPose`).
- `defaultPresetId`: key into the standard preset registry; used when no explicit preset is stored.
- `promptBuilder(settings, ctx?)`: returns a prompt string or JSON structure. It should accept fully-resolved settings (preset defaults + overrides already applied).
- `buildGenerationPayload(context)`: server-only entry point. Receives `GenerationContext` with selfie keys, helpers, and merged settings. Must return a `GenerationPayload` containing `prompt`, `referenceImages`, `labelInstruction`, `aspectRatio`, and `aspectRatioDescription`.
- `persistenceAdapter.serialize(uiSettings)`: store UI selections (include `presetId`).
- `persistenceAdapter.deserialize(raw)`: restore UI selections, repairing legacy formats and applying sane fallbacks.
- Optional `resolveStandardPreset(preset, settings)`: allow package-specific tweaks to a preset clone before it is applied.

## Standard Presets

`src/domain/style/packages/standard-presets.ts` defines the canonical photo archetypes including the “Universal Portrait” fallback. Each preset captures:

- Technical defaults (shot type, aspect ratio, focal length, aperture, shutter, ISO, orientation).
- Lighting metadata (quality, direction, setup notes, colour temperature).
- Environment notes (background description and recommended spacing).
- Composition guidance (headroom, looking space, ground visibility).
- Pose defaults (body angle, head position, shoulders, weight, arms, sitting pose, expression) plus technique notes (always includes the chin out/down reminder).
- Narrative `promptTemplate` summarising the look.

`getDefaultPresetSettings(presetId)` returns a `PhotoStyleSettings` object seeded with a preset’s camera + pose defaults; spread this into `defaultSettings` when defining a package. `applyStandardPreset(presetId, styleSettings)` clones runtime settings, fills “user-choice” fields with preset defaults, and returns `{ preset, settings }`. Packages should call this at the top of their prompt builder/server payload.

### Command emission helpers

Packages generate command lists using the resolved settings, e.g.:

```
usePreset(Corporate Headshot)
setShotType(Medium Close-Up)
setFocalLength(85mm)
setAperture(f/4.0)
setLightingQuality(Soft Diffused)
setShutterSpeed(1/200)
setOrientation(vertical)
setAspectRatio(4:5)
setBodyAngle(Slight Angle)
setHeadPosition(Face Turn ...)
setShoulderPosition(Front Shoulder Dropped)
setWeightDistribution(70% back foot)
setArmPosition(Not Visible)
setSittingPose(...)
```

After the command block, append the preset’s narrative template (optional) before the JSON payload.

## Shared Utilities

- `camera-presets.ts`: normalises shot types, focal lengths, apertures, shutter speeds, lighting qualities, and maps shot types to orientation hints.
- `pose-presets.ts`: encapsulates pose defaults, technique notes, and exposes the global “chin out & down” reminder.
- `standard-settings.ts`: orchestrates preset application and merges overrides.
- `reference-utils.ts`: vertical selfie composites, logo/background references, fallback reference payload assembly.

## Generation Flow

1. **Style resolution** (`style-settings.ts`): merges saved/context/job settings, ensures `presetId` defaults to `stylePackage.defaultPresetId`.
2. **applyStandardPreset**: packages call this to get `preset` + `effectiveSettings` (clone with defaults applied).
3. **Prompt builder** uses `effectiveSettings` to assemble environment, camera, pose, command list, and narrative. All references to raw inputs should happen after preset application.
4. **Generation payload builder**:
   - Preprocess selfies when needed (`context.assets.preprocessSelfie`).
   - Build reference images (`buildDefaultReferencePayload`, `buildCollectiveReferenceImages`, etc.).
   - Generate final prompt via `promptBuilder`.
5. **Worker** sends the `GenerationPayload` to Gemini and uploads outputs to S3.

## Adding a New Package

1. Copy an existing package (`headshot1` is the canonical example).
2. Choose a `defaultPresetId` from `standard-presets.ts` or add a new preset describing the look.
3. Populate `defaultSettings` and `visibleCategories` appropriately (include the new camera/pose fields).
4. Implement the client package (`index.ts`), server variant (`server.ts`), optional preprocessors, and persistence adapter adjustments.
5. Use `applyStandardPreset` in both prompt builder and server payload builder.
6. Expose any custom background/branding logic as needed.
7. Update UI components if new visible categories are added (`StyleForm`, etc.).

## Quick Reference

- `PhotoStyleSettings` now stores `presetId`, focal length, aperture, lighting quality, shutter speed, and pose fields.
- **Always** store `presetId` in serialized settings so future merges can reconstruct the same baseline.
- Reuse shared helpers (camera/pose/preset utilities) to keep packages consistent and reduce duplication.
- Keep prompt builders declarative; avoid side effects beyond shaping the structured payload.
- When introducing a new preset, update the quick preset matrix in `standard-presets.ts` and ensure command outputs remain human-readable.
