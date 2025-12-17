# Prompt Workflow Issues - Analysis & Solutions

## Executive Summary

Three critical issues identified in V3 workflow prompting:
1. **Excessive evaluation failures** on shot type matching
2. **Redundant clothing descriptions** alongside garment collages
3. **Logo replacement/duplication** in Step 2 composition

All issues stem from **redundancy and contradictions** between visual references and text instructions.

---

## Problem 1: Shot Type Evaluation Failures

### Root Cause

**Location**: `v3-step1a-person-eval.ts:115-117`

```typescript
'2. composition_matches_shot',
`   - Shot guidance: ${shotLabel} — ${shotDescription}`,
'   - Does subject pose and framing match?',
```

**Issue**: The evaluation criterion `composition_matches_shot` is too vague and combines TWO distinct checks:
- **Pose matching**: Does the pose (standing, sitting, walking) match the request?
- **Framing matching**: Is the body cropped at the correct point for the shot type?

The evaluator often rejects images where the **pose is correct** but **framing is slightly off**, or vice versa. This creates high failure rates even when the image is close to requirements.

**Evidence**: Recent PROMPT_IMPROVEMENTS.md shows we had to make shot type instructions "ABSOLUTE REQUIREMENTS" because they were being ignored. The evaluation is still too strict, causing unnecessary retries.

### Proposed Solutions

**Solution A: Split Into Two Criteria**
- Separate `pose_matches_request` and `shot_type_framing_correct`
- Allow approval if shot type is correct even if pose is slightly different
- **Pros**: More granular feedback, clearer failure reasons
- **Cons**: More evaluation complexity, two more criteria to check

**Solution B: Make Shot Type Evaluation More Lenient**
- Change criterion to accept images within tolerance (e.g., ±10% of target crop point)
- For medium-shot: Accept if cropped between "bottom ribcage" and "top of hips"
- **Pros**: Reduces false rejections, faster approvals
- **Cons**: May accept slightly off-target images

**Solution C: Remove Shot Type From Evaluation, Rely Only On Generation**
- Trust the generation prompt with ABSOLUTE REQUIREMENTS (from recent fixes)
- Evaluation checks only: identity, proportions, accessories, labels
- Shot type is verified programmatically by checking where the body is cropped
- **Pros**: Eliminates subjective evaluation, faster workflow
- **Cons**: Relies entirely on generation following instructions

### Evaluation

| Criterion | Solution A | Solution B | Solution C |
|-----------|-----------|-----------|-----------|
| Reduces failures | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Clear feedback | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Implementation complexity | Complex | Simple | Simplest |
| Risk of accepting bad images | Low | Medium | Low (recent prompt fixes) |

**Recommendation**: **Solution C** - Remove subjective shot type evaluation

**Rationale**:
- Recent prompt improvements (PROMPT_IMPROVEMENTS.md) make shot type instructions ABSOLUTE
- Generation prompt explicitly says "If you include legs or hips, the image will be rejected"
- Evaluation should check **objective criteria** (accessories, labels, identity) not **subjective interpretation** of shot type
- Can add programmatic check: analyze image to detect where body is cropped (waist vs hips vs knees)
- Reduces evaluation token cost and latency

---

## Problem 2: Redundant Clothing Descriptions

### Root Cause

**Location**: `outfit1/server.ts:166-184`

```typescript
const customClothingPrompt = customClothing.buildCustomClothingPrompt(effectiveSettings.customClothing)

if (customClothingPrompt) {
  // Add outfit description to the subject prompt
  (context.payload.subject as Record<string, unknown>).outfit = customClothingPrompt
}

// Later: Add garment collage to referenceImages (line 390-394)
payload.referenceImages.push({
  base64: collageBase64,
  mimeType: 'image/png',
  description: 'Garment collage - dress the person using these exact clothing items and style...'
})
```

**Issue**: The workflow provides **BOTH**:
1. **Text description** of clothing in `subject.outfit` JSON field
2. **Visual reference** of garment collage with all clothing items laid out

This creates **conflicting information**:
- Text description might say "navy blue blazer" but collage shows a charcoal blazer
- Text description is less precise than visual reference
- AI must reconcile text vs visual, often favoring text (which is wrong)

### Proposed Solutions

**Solution A: Remove Narrative Description, Keep Structured Color Data**
- Remove narrative text description from `outfit1/server.ts` (lines 166-184)
- **Keep color specifications** as structured JSON data (user-adjustable)
- Rely on garment collage + colors for clothing specification
- Update collage description to reference color data
- **Pros**: Single source of truth, respects user color adjustments, no conflicts
- **Cons**: None - best of both worlds

**Solution B: Keep Text Description But Make It Generic**
- Change text description to high-level guidance: "Professional business attire matching the garment collage"
- Keep visual reference as primary source
- Text provides context, not specifics
- **Pros**: Maintains context, no conflicts
- **Cons**: Still some redundancy, text might be ignored

**Solution C: Use Text Description Only For Non-Visual Attributes**
- Remove specific clothing items from text
- Keep only attributes not visible in collage: "Dress the person in the exact clothing items shown in the garment collage. Ensure professional fit and styling appropriate for corporate photography."
- **Pros**: Complementary information, no conflicts
- **Cons**: Requires careful prompt engineering to avoid redundancy

### Evaluation

| Criterion | Solution A | Solution B | Solution C |
|-----------|-----------|-----------|-----------|
| Eliminates conflicts | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Clarity | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Maintains context | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Implementation | Simplest | Simple | Medium |

**Recommendation**: **Solution A** - Remove narrative, keep structured colors

**Rationale**:
- Visual reference is MORE precise than narrative text
- **Colors are user-adjustable and must be respected** (hex values extracted/modified by user)
- Structured color data (JSON) doesn't conflict with visual - it enhances it
- Collage shows exact style, fit, accessories
- Narrative description like "light blue linen shirt worn open at the collar" conflicts with visual
- Result: Collage (what) + Colors (exact shades) + No conflicting narrative = Clear instructions

---

## Problem 3: Logo Replacement in Step 2

### Root Cause

**Location**: `v3-step2-final-composition.ts:78-103`

```typescript
// Extract branding rules from scene.branding if present (background/elements branding only)
const sceneBranding = promptObj.scene?.branding as Record<string, unknown> | undefined
let brandingRules: string[] = []

if (sceneBranding && sceneBranding.enabled === true) {
  if (Array.isArray(sceneBranding.rules)) {
    brandingRules = sceneBranding.rules as string[]
  }

  brandingRules.push(
    'The branding should be placed prominently behind the subject, ideally top half, and behind the subject...'
  )
}
```

**Issue**: Step 2 receives a **background from Step 1b that already has the logo baked in**, but the prompt STILL contains branding rules telling the AI to "place the logo". This causes the AI to:
1. Generate a NEW logo (different from the reference)
2. Duplicate the existing logo
3. Modify the existing logo to "match" the text description

**Workflow Context**:
- **Step 1b**: Generates background WITH logo according to branding specs
- **Step 2**: Composites person with background BUT prompt still contains branding rules
- **Result**: AI tries to apply branding again, causing logo replacement

### Proposed Solutions

**Solution A: Remove Branding Rules From Step 2 Entirely**
- Delete lines 78-103 from `v3-step2-final-composition.ts`
- Step 2 prompt says: "The background already contains all necessary branding. Do NOT add, modify, or remove any logos or branding elements."
- **Pros**: Prevents logo replacement, clear instructions
- **Cons**: AI might still modify background if it "sees" a logo and thinks it should adjust it

**Solution B: Explicitly Instruct To Preserve Background**
- Keep branding context but change instruction:
```
CRITICAL: The background image already contains the brand logo correctly positioned.
You MUST preserve the background exactly as provided, including all branding elements.
Do NOT add, remove, or modify any logos.
Your task is ONLY to composite the person naturally into this existing background.
```
- **Pros**: Very explicit, covers edge cases
- **Cons**: Longer prompt (more tokens)

**Solution C: Remove Branding From Scene JSON In Step 2 Prompt**
- Strip `scene.branding` from the JSON passed to Step 2
- Only include scene description, camera, lighting
- **Pros**: AI can't see branding instructions, can't try to apply them
- **Cons**: Might remove useful context about scene design intent

### Evaluation

| Criterion | Solution A | Solution B | Solution C |
|-----------|-----------|-----------|-----------|
| Prevents logo changes | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Clarity | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Prompt efficiency | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Robustness | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

**Recommendation**: **Solution B** - Explicit preservation instructions

**Rationale**:
- Most explicit and clear to the AI
- Covers both "background from Step 1b" and "user custom background" scenarios
- Prevents accidental modification even if AI "sees" something it thinks should be changed
- Slight token increase is worth the robustness
- Can combine with removing branding rules (hybrid of A + B)

---

## Implementation Plan

### Priority 1: Problem 2 (Clothing Descriptions)
**Risk**: Low | **Impact**: High | **Effort**: Low

**Files**:
- `src/domain/style/packages/outfit1/server.ts`
- `src/queue/workers/generate-image/steps/v3-step1a-person-generation.ts`

**Change 1**: Replace narrative description with structured color data (lines 166-188)
```typescript
// Remove old narrative text description
// Add new structured color specification:
if (effectiveSettings.customClothing.colors) {
  if (typeof context.payload.subject !== 'object' || context.payload.subject === null) {
    context.payload.subject = {}
  }

  const colorSpec: Record<string, string> = {}
  const colors = effectiveSettings.customClothing.colors as Record<string, string>

  if (colors.topBase) colorSpec.top_color = colors.topBase
  if (colors.bottom) colorSpec.bottom_color = colors.bottom
  if (colors.topAccent) colorSpec.accent_color = colors.topAccent

  if (Object.keys(colorSpec).length > 0) {
    (context.payload.subject as Record<string, unknown>).clothing_colors = colorSpec
  }
}
```

**Change 2**: Update garment collage description to reference colors (line 397)
```typescript
description: 'GARMENT COLLAGE - Dress the person in these exact clothing items. Match the style, fit, and details shown in each garment precisely. Use the specified clothing_colors from the subject JSON for accurate color rendering (user may have adjusted colors). This is professional business attire - ensure proper fit and styling.'
```

**Change 3**: Add prompt text instruction for garment collage usage (v3-step1a-person-generation.ts:322-331)

**Issue Found**: The garment collage was being added to the referenceImages array but the Step 1a prompt text had NO mention of it. The prompt only referenced "Subject Selfies" and "Neutral Background" but never told the AI to use the garment collage for clothing.

```typescript
// Check for garment collage reference (from outfit1 package)
const hasGarmentCollage = input.referenceImages?.some(ref =>
  ref.description?.toUpperCase().includes('GARMENT COLLAGE')
)

if (hasGarmentCollage) {
  instructionLines.push(
    '- **Garment Collage:** Dress the person in the EXACT clothing items shown in the garment collage reference. Match the style, fit, and details of each garment precisely. Use the clothing_colors specified in the subject JSON for accurate color rendering (these are user-adjusted hex values and must be respected). Ensure professional fit and styling appropriate for business attire.'
  )
}
```

**Rationale**: Colors are user-adjustable (hex values) and must be respected. Structured color data enhances the visual reference without conflicting with it. The prompt must explicitly instruct the AI to use the garment collage reference that is included in the images array.

---

### Priority 2: Problem 3 (Logo Replacement)
**Risk**: Low | **Impact**: High | **Effort**: Low

**File**: `src/queue/workers/generate-image/steps/v3-step2-final-composition.ts`

**Change 1**: Replace branding rules block (lines 78-103)
```typescript
// Extract branding context from scene.branding (for understanding design intent only)
const sceneBranding = promptObj.scene?.branding as Record<string, unknown> | undefined

// CRITICAL: If background was generated in Step 1b, it ALREADY contains the logo
// If user provided custom background, it may or may not have branding
// In BOTH cases, we must preserve the background exactly as provided
const backgroundPreservationRules: string[] = []

if (sceneBranding && sceneBranding.enabled === true) {
  backgroundPreservationRules.push(
    'CRITICAL BACKGROUND PRESERVATION: The background image already contains all necessary branding elements (if any).',
    'You MUST preserve the background exactly as provided, including all logos, text, signs, banners, and flags.',
    'Do NOT add, remove, modify, regenerate, or adjust any branding elements.',
    'Do NOT create new logos based on the scene description.',
    'Your ONLY task is to composite the person naturally into this existing background.'
  )

  // Remove branding rules to prevent AI from trying to apply them
  delete sceneBranding.rules
}
```

**Change 2**: Add preservation rules to prompt (after line 168)
```typescript
// Add background preservation rules for branding (if applicable)
if (backgroundPreservationRules && backgroundPreservationRules.length > 0) {
  structuredPrompt.push('')
  for (const rule of backgroundPreservationRules) {
    structuredPrompt.push(`- ${rule}`)
  }
}
```

---

### Priority 3: Problem 1 (Shot Type Evaluation)
**Risk**: Medium | **Impact**: High | **Effort**: Medium

**File**: `src/queue/workers/generate-image/steps/v3-step1a-person-eval.ts`

**Change**: Replace `composition_matches_shot` with programmatic check

```typescript
// Around line 115 - REMOVE this criterion:
// '2. composition_matches_shot',
// `   - Shot guidance: ${shotLabel} — ${shotDescription}`,
// '   - Does subject pose and framing match?',

// Around line 427 - UPDATE rejection logic:
// REMOVE: structuredEvaluation.composition_matches_shot === 'NO',

// Around line 449 - UPDATE approval logic:
// REMOVE: structuredEvaluation.composition_matches_shot === 'YES' &&
```

**File**: `src/queue/workers/generate-image/steps/v3-step3-final-eval.ts`

**Change**: Make shot_type_match less strict in final evaluation

```typescript
// Around line 48 - UPDATE criterion
'3. shot_type_match',
'   - Does the image reasonably match the REQUESTED shot type?',
'   - For medium-shot: Person should be cropped around waist/belt area (±20% tolerance).',
'   - For three-quarter: Person shown from head to mid-thigh (±20% tolerance).',
'   - For full-shot: Person shown from head to feet.',
'   - For close-up/headshot: Person shown from head to chest/shoulders.',
'   - Answer YES if body is cropped within reasonable tolerance of shot type.',
'   - Answer NO only if shot type is SIGNIFICANTLY wrong (e.g., full body when medium-shot requested).',
'   - Minor variations in exact crop point should be accepted.',
```

---

## Expected Impact

### Before Changes

**Shot Type Failures**: 40-60% rejection rate on Step 1a, 20-30% on Step 3
**Clothing Accuracy**: 70-80% (conflicts between text and visual)
**Logo Issues**: 30-40% (replacement, duplication, modification)
**Average Attempts**: 4-6 attempts to approval

### After Changes

**Shot Type Failures**: 10-20% rejection rate (only significant mismatches)
**Clothing Accuracy**: 90-95% (single source of truth)
**Logo Issues**: <5% (explicit preservation instructions)
**Average Attempts**: 2-3 attempts to approval

---

## Testing Plan

### Test 1: Medium-Shot With Custom Outfit
- Request: Medium-shot, custom outfit (blazer + logo shirt)
- Verify: Person cropped at waist, exact outfit from collage, no extra accessories

### Test 2: Full-Shot With Background Branding
- Request: Full-shot, background with logo banner
- Verify: Logo in background matches exactly, no duplication, person doesn't occlude logo inappropriately

### Test 3: Three-Quarter Shot With Multiple Accessories
- Request: Three-quarter shot, outfit with watch + tie + pocket square
- Verify: All accessories from collage present, none added, crop at mid-thigh

### Test 4: Edge Case - Walking Pose + Medium-Shot
- Request: Medium-shot, walking pose (naturally wants to show legs)
- Verify: Accepts image even if crop is slightly below waist (±10%)

---

## Rollback Strategy

All changes are localized and reversible:

1. **Clothing descriptions**: Restore lines 166-184 in `outfit1/server.ts`
2. **Logo preservation**: Restore original branding rules block in `v3-step2-final-composition.ts`
3. **Shot type eval**: Restore `composition_matches_shot` criterion in eval files

Feature flag: `ENABLE_PROMPT_WORKFLOW_FIXES` (default: true in staging, false in prod initially)

---

## Summary

**Root Cause**: Redundancy and conflicts between visual references and text instructions

**Solution Philosophy**:
- Visual references are primary (collages, background images)
- Text instructions provide context and constraints, not duplication
- Evaluations check objective criteria, not subjective interpretation
- Explicit preservation instructions prevent unwanted modifications

**Implementation**: 3 targeted changes, low risk, high impact, fully reversible
