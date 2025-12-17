# Shot Type Enforcement - Prompt Improvements

## Problem Summary
The image generation workflow was not respecting the requested shot type (e.g., medium-shot). Full-body images were being generated and approved when medium shots (head to waist) were requested.

## Root Causes Identified

1. **Contradictory Instructions in Step 2**: Prompt said "show medium-shot" but also "when in doubt, show MORE body"
2. **Lenient Step 3 Evaluation**: Allowed full-body shots to pass as long as feet touched bottom edge
3. **Vague Step 1a Constraint**: Only said "Respect the requested shot type" without specifics
4. **Pose-Shot Conflict**: Walking/in-motion pose naturally wants to show legs, conflicting with medium-shot

## Fixes Implemented

### Fix 1: Removed Contradictory "Body Framing Rules" from Step 2
**File**: `src/queue/workers/generate-image/steps/v3-step2-final-composition.ts`

**Removed** (lines 157-163):
```typescript
'**CRITICAL Body Framing Rules:**',
'- NEVER crop the person at the waist or mid-torso. This looks unprofessional.',
'- For medium-shot: Show from head down to the waist, showing torso and arms.',
'- For three-quarter: Show from head to mid-thigh (3/4 body length).',
'- For full-shot: Show the entire body from head to feet.',
'- For close-up/headshot: Show from head to chest/shoulders.',
'- When in doubt, show MORE of the body, not less. It is better to show full body than to cut off awkwardly.',
```

**Why**: This section contradicted itself ("NEVER crop at waist" vs "medium-shot: head to waist") and told AI to show MORE body when uncertain.

---

### Fix 2: Made Step 3 Evaluation Strict About Shot Type
**File**: `src/queue/workers/generate-image/steps/v3-step3-final-eval.ts`

**Changed from**:
```typescript
'3. body_framing',
'   - Is the person\'s body shown at an appropriate length (NOT cut off awkwardly at the waist or mid-torso)?',
'   - For professional photos, the person should show at minimum 3/4 body (head to mid-thigh) or full body.',
'   - Answer NO if the person is cut off mid picture at the waist, stomach, or mid-torso (awkward mid-body cropping). IMPORTANT: Bottom-border cutoffs (where the person\'s lower body extends to the bottom edge of the image) are acceptable and should be answered YES.',
'   - Answer YES if showing: full body, 3/4 body (to mid-thigh/knees), intentional close-up (head/shoulders only), OR if the person is cut off at the bottom border of the image (feet/legs at image edge).',
```

**Changed to**:
```typescript
'3. shot_type_match',
'   - Does the image match the REQUESTED shot type from the generation prompt?',
'   - For medium-shot: Person MUST be cropped at waist/belt area. Hips and legs should NOT be visible.',
'   - For three-quarter: Person shown from head to mid-thigh.',
'   - For full-shot: Person shown from head to feet.',
'   - For close-up/headshot: Person shown from head to chest/shoulders.',
'   - Answer YES ONLY if the visible body parts match the requested shot type.',
'   - Answer NO if showing MORE body than requested (even if composition looks professional).',
'   - "Looking professional" does NOT override shot type requirements.',
```

**Why**: Previous evaluation allowed any body length as long as it didn't look "awkward". New version strictly enforces the requested shot type.

---

### Fix 3: Made Shot Type Constraint Absolute in Step 1a
**File**: `src/queue/workers/generate-image/steps/v3-step1a-person-generation.ts`

**Changed from**:
```typescript
shotDescription
  ? `- Shot Type: Respect the requested shot type (${shotDescription}) and ensure proper framing.`
  : '- Shot Type: Follow the shot type specifications in the JSON.'
```

**Changed to**:
```typescript
...(shotDescription === 'medium-shot' ? [
  '- Shot Type (ABSOLUTE REQUIREMENT): MEDIUM SHOT - frame from top of head to bottom of ribcage/top of belt area.',
  '- The bottom edge of the image MUST crop at the waist/belt level. DO NOT show hips, legs, knees, or feet.',
  '- If you include legs or hips, the image will be rejected.'
] : shotDescription === 'full-shot' ? [
  '- Shot Type (ABSOLUTE REQUIREMENT): FULL SHOT - frame from top of head to feet, showing entire body.'
] : shotDescription === 'close-up' || shotDescription === 'headshot' ? [
  '- Shot Type (ABSOLUTE REQUIREMENT): CLOSE-UP/HEADSHOT - frame from top of head to chest/shoulders only.'
] : shotDescription === 'three-quarter' ? [
  '- Shot Type (ABSOLUTE REQUIREMENT): THREE-QUARTER SHOT - frame from top of head to mid-thigh.'
] : [
  `- Shot Type: Respect the requested shot type (${shotDescription}) and ensure proper framing.`
])
```

**Why**: Vague "Respect" language replaced with explicit, absolute requirements specifying exactly what body parts should/should not be visible.

---

### Fix 4: Clarified Shot Type Maintenance in Step 2
**File**: `src/queue/workers/generate-image/steps/v3-step2-final-composition.ts`

**Changed from**:
```typescript
'The person can not be changed, the pose, expression,clothes and every detail must remain the same.',
```

**Changed to**:
```typescript
'The person can not be changed - pose, expression, clothes, body framing, and crop points must remain EXACTLY the same.',
`CRITICAL: The person is already framed as ${shotType}. DO NOT reframe or change where the body is cropped. Maintain the exact crop point from the base image.`,
```

**Why**: Explicitly prevents Step 2 from reframing the person or changing the crop point established in Step 1a.

---

## Expected Impact

### Before Changes
- **Attempt 1**: Full-body shot → ❌ REJECTED
- **Attempt 2**: Head to mid-thigh/knees → ❌ REJECTED
- **Attempt 3**: Head to waist/mid-thigh → ✅ APPROVED (incorrect)
- **Step 2 Final**: Head to "just above ankles" → ✅ APPROVED (incorrect)

### After Changes
- **Step 1a**: Will generate ONLY head to waist for medium-shot (absolute requirement)
- **Step 1a Eval**: Will reject any image showing hips/legs for medium-shot
- **Step 2**: Will maintain exact crop point from Step 1a
- **Step 3 Eval**: Will strictly enforce shot type match

## Prompt Philosophy Changes

### Old Approach
- **Defined** shot type in JSON
- **Contradicted** it in rules
- **Ignored** it in evaluation
- Result: Cascading failure

### New Approach
- Shot type constraints are **absolute** (not suggestions)
- Shot type is **consistent** across all steps (no contradictions)
- Evaluation **strictly enforces** shot type (no leniency)

## Testing Recommendations

1. Test medium-shot generation with walking pose (previous failure case)
2. Verify Step 1a rejects images with visible legs/hips
3. Verify Step 3 rejects full-body images when medium-shot requested
4. Test other shot types (full, three-quarter, close-up) for regression

## Files Modified

1. `src/queue/workers/generate-image/steps/v3-step1a-person-generation.ts` - Absolute shot type constraints
2. `src/queue/workers/generate-image/steps/v3-step2-final-composition.ts` - Removed contradictions, added crop maintenance
3. `src/queue/workers/generate-image/steps/v3-step3-final-eval.ts` - Strict shot type evaluation

---

**Date**: December 17, 2025
**Issue**: Shot type not respected (full-body generated for medium-shot)
**Resolution**: Made shot type constraints absolute, consistent, and strictly enforced
