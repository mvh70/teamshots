# Gemini Fallback Provider Implementation Plan

## Overview

Add multi-tier fallback support for Gemini image generation to improve production reliability. Currently, the system uses either Vertex AI or REST API, but has no fallback mechanism. This plan adds third-party providers (fal.ai and Replicate) as fallback options when Google providers fail.

## Current State

- `src/queue/workers/generate-image/gemini.ts` contains two Google providers:
  - `generateWithGeminiVertex` - Vertex AI (service account)
  - `generateWithGeminiRest` - AI Studio REST API (API key)
- Current behavior: Uses REST if API key exists, otherwise Vertex. No fallback on failure.

## Goal

Implement a fallback chain that tries providers in order:
1. Primary Google provider (Vertex or REST, configurable)
2. Secondary Google provider (the other one)
3. fal.ai (nano-banana) - True redundancy outside Google
4. Replicate (nano-banana) - Additional redundancy

## Provider Comparison

| Provider | Price/Image | SDK | Status | API Key Location |
|----------|-------------|-----|--------|------------------|
| **fal.ai** | $0.0398 | `@fal-ai/client` | Available | https://fal.ai/account/keys |
| **Replicate** | $0.039 | `replicate` | Available | https://replicate.com/account/api-tokens |

Both providers:
- Use the same model (nano-banana/Gemini 2.5 Flash) = identical quality
- Have official SDKs available
- Are production-ready
- Only used when Google providers fail (minimal cost impact)

## Implementation Steps

### Step 1: Install Dependencies

Add the required SDKs to your project:
- Install `@fal-ai/client` package
- Install `replicate` package

### Step 2: Create fal.ai Integration Module

**File**: `src/queue/workers/generate-image/gemini-fal.ts`

**Important differences from Gemini:**
- fal.ai has TWO endpoints: text-to-image (no reference images) and image-to-image/edit (with reference images)
- Must use the `/edit` endpoint: `fal-ai/gemini-25-flash-image/edit`
- Uses `image_urls` parameter (not `image_input`) - accepts URLs or data URIs
- Default `aspect_ratio` is `'auto'` (not `'1:1'`)
- Does NOT support `resolution` parameter (1K/2K/4K) - only aspect ratio
- Does NOT support `temperature`/`topP` parameters

**What to implement:**
- Export function `generateWithGeminiFal` matching the signature of existing Gemini functions
- Read `FAL_API_KEY` from environment using `Env.string()`
- Configure fal.ai client with API key using `fal.config({ credentials })`
- Validate that reference images are provided
- Convert images to data URI format (`data:${mimeType};base64,${base64}`)
- Call `fal.subscribe('fal-ai/gemini-25-flash-image/edit', { input: {...} })` with:
  - `prompt` parameter
  - `image_urls` as array of data URIs (note: different parameter name)
  - `aspect_ratio` (use provided value or default to 'auto' if not provided)
  - `output_format: 'png'` (to match Gemini output)
  - `num_images: 1`
- Extract image URLs from response (`result.images` array)
- Fetch each image URL and convert to Buffer
- Return array of Buffers
- Add error handling and logging using existing Logger
- Note: Ignore `resolution` parameter (not supported by fal.ai)

**Reference**: fal.ai edit API docs at https://fal.ai/models/fal-ai/gemini-25-flash-image/edit/api

### Step 3: Create Replicate Integration Module

**File**: `src/queue/workers/generate-image/gemini-replicate.ts`

**Important differences from Gemini:**
- Uses `image_input` parameter (same as Gemini) - accepts URLs or data URIs
- Default `aspect_ratio` is `'match_input_image'` (not `'1:1'`)
- Default `output_format` is `'jpg'` (not `'png'`)
- Does NOT support `resolution` parameter (1K/2K/4K) - only aspect ratio
- Does NOT support `temperature`/`topP` parameters
- Output can be single URL string or array of URLs

**What to implement:**
- Export function `generateWithGeminiReplicate` matching the signature of existing Gemini functions
- Read `REPLICATE_API_KEY` from environment using `Env.string()`
- Initialize Replicate client with API key
- Validate that reference images are provided
- Convert images to data URI format
- Call `replicate.run('google/nano-banana:latest', { input: {...} })` with:
  - `prompt` parameter
  - `image_input` as array of data URIs
  - `aspect_ratio` (use provided value or default to '1:1' if not provided - override Replicate's default)
  - `output_format: 'png'` (override default 'jpg' to match Gemini output)
- Handle response (can be single URL string or array of URLs)
- Fetch each image URL and convert to Buffer
- Return array of Buffers
- Add error handling and logging using existing Logger
- Note: Ignore `resolution` parameter (not supported by Replicate)

**Reference**: Replicate API docs at https://replicate.com/google/nano-banana/api

### Step 4: Update Main Gemini Function

**File**: `src/queue/workers/generate-image/gemini.ts`

**What to modify in `generateWithGemini` function:**

1. **Check available providers:**
   - Check for `GOOGLE_CLOUD_API_KEY` (REST API)
   - Check for `GOOGLE_APPLICATION_CREDENTIALS` or `GOOGLE_PROJECT_ID` (Vertex AI)
   - Check for `FAL_API_KEY` (fal.ai)
   - Check for `REPLICATE_API_KEY` (Replicate)

2. **Build provider priority list:**
   - Read `GEMINI_PRIMARY_PROVIDER` env var (default: 'vertex')
   - If primary is 'vertex' and service account exists, add 'vertex' first
   - If API key exists, add 'rest'
   - If primary is 'rest' and service account exists, add 'vertex' as backup
   - If `FAL_API_KEY` exists, add 'fal'
   - If `REPLICATE_API_KEY` exists, add 'replicate'
   - Throw error if no providers available

3. **Implement fallback loop:**
   - Iterate through providers in order
   - For each provider, try calling the corresponding function:
     - 'vertex' → `generateWithGeminiVertex()`
     - 'rest' → `generateWithGeminiRest()` (with safety settings conversion)
     - 'fal' → Dynamic import and call `generateWithGeminiFal()`
     - 'replicate' → Dynamic import and call `generateWithGeminiReplicate()`
   - On success, return result immediately
   - On error:
     - Check if it's a rate limit error using `isRateLimitError()` helper
     - If rate limit AND not last provider: log warning and continue to next provider
     - If not rate limit OR last provider: throw error immediately
   - Log which provider is being attempted with attempt number

### Step 5: Update Environment Validation

**File**: `src/lib/env-validation.ts`

**What to add:**
- Add `FAL_API_KEY: z.string().optional()` to schema
- Add `REPLICATE_API_KEY: z.string().optional()` to schema
- Update the `.refine()` validation to check for at least one provider:
  - Google API key OR service account OR fal.ai key OR Replicate key
  - Update error message to include all provider options

### Step 6: Update Environment Variables

**What to configure:**
- `GEMINI_PRIMARY_PROVIDER`: Optional, 'vertex' (default) or 'rest'
- `FAL_API_KEY`: Optional, get from https://fal.ai/account/keys
- `REPLICATE_API_KEY`: Optional, get from https://replicate.com/account/api-tokens

**Note**: At least one provider must be configured (Google or third-party).

## Testing Checklist

- [ ] Test with only Google credentials (should work, no third-party fallback)
- [ ] Test with only fal.ai credentials (should work standalone)
- [ ] Test with only Replicate credentials (should work standalone)
- [ ] Test with all credentials configured (should fallback through all providers)
- [ ] Test with `GEMINI_PRIMARY_PROVIDER=rest` (should try REST first)
- [ ] Simulate rate limit errors (should fallback to next provider)
- [ ] Verify fal.ai returns images correctly (check response format)
- [ ] Verify Replicate returns images correctly (check response format)
- [ ] Test error handling when all providers fail

## Important Notes

- The `isRateLimitError` helper already exists at `src/lib/rate-limit-retry.ts` - use it for error detection
- Both fal.ai and Replicate use the same model (nano-banana) = identical output quality
- Fallback only triggers on rate limit errors - other errors fail immediately
- Cost impact is minimal since third-party providers only used when Google fails
- Monitor fallback usage - if used frequently, consider increasing Google quotas

## API Differences from Gemini

**fal.ai:**
- Must use `/edit` endpoint for reference images: `fal-ai/gemini-25-flash-image/edit`
- Uses `image_urls` parameter (not `image_input`)
- Default `aspect_ratio` is `'auto'` (override to match Gemini behavior)
- Does NOT support `resolution` parameter (1K/2K/4K)
- Does NOT support `temperature`/`topP` parameters

**Replicate:**
- Uses `image_input` parameter (same as Gemini)
- Default `aspect_ratio` is `'match_input_image'` (override to '1:1' to match Gemini)
- Default `output_format` is `'jpg'` (override to 'png' to match Gemini)
- Does NOT support `resolution` parameter (1K/2K/4K)
- Does NOT support `temperature`/`topP` parameters
- Output format: single URL or array of URLs (handle both)

**Both providers:**
- Accept data URIs for images (format: `data:${mimeType};base64,${base64}`)
- Return image URLs that must be fetched
- Do not support resolution parameter - only aspect ratio

## Files to Create/Modify

1. **Create**: `src/queue/workers/generate-image/gemini-fal.ts`
2. **Create**: `src/queue/workers/generate-image/gemini-replicate.ts`
3. **Modify**: `src/queue/workers/generate-image/gemini.ts` (update `generateWithGemini` function)
4. **Modify**: `src/lib/env-validation.ts` (add API key validation)
5. **Modify**: `package.json` (add dependencies)

## Cost Analysis

| Provider | Price/Image | Usage Scenario |
|----------|-------------|----------------|
| Google Direct | ~$0.01-0.02 | Primary usage (most requests) |
| fal.ai | $0.0398 | Fallback only (when Google fails) |
| Replicate | $0.039 | Fallback only (when Google fails) |

**Impact**: Minimal - third-party providers only used during Google outages or rate limits. The ~2-4x cost increase is acceptable for production reliability.

## Provider Selection Recommendations

**Maximum Redundancy (Recommended for Production):**
- Configure both `FAL_API_KEY` and `REPLICATE_API_KEY`
- Provides 4-tier fallback: Vertex → REST → fal.ai → Replicate
- Best uptime protection

**Cost-Optimized:**
- Configure only `FAL_API_KEY` (slightly cheaper)
- Provides 3-tier fallback: Vertex → REST → fal.ai
- Still provides true redundancy outside Google

**Minimal Setup:**
- Configure only Google providers (existing setup)
- Provides 2-tier fallback within Google ecosystem
- No third-party dependencies, but vulnerable to Google-wide outages

## Estimated Time

- fal.ai integration: 30-45 minutes
- Replicate integration: 30-45 minutes
- Fallback chain refactor: 30-45 minutes
- Testing and validation: 30-45 minutes
- **Total: 2-3 hours**

## Success Criteria

- System successfully falls back to fal.ai when Google providers rate limit
- System successfully falls back to Replicate when fal.ai also fails
- All existing functionality continues to work unchanged
- Error messages clearly indicate which provider failed
- Logging shows fallback chain progression
