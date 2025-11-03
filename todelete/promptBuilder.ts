// Temporary location for prompt builders marked for removal/migration

export function buildStructuredPromptFromStyle(style: Record<string, unknown>, basePrompt?: string): string {
  const scene: Record<string, unknown> = { environment: {} as Record<string, unknown> }
  const subject: Record<string, unknown> = { type: 'subject from the attached image, maintaining the facial structure, identity, and key features of the input image.' }
  const framing_composition: Record<string, unknown> = {}
  const camera: Record<string, unknown> = {}
  const lighting: Record<string, unknown> = {}
  const rendering_intent: Record<string, unknown> = {}
  const post_processing: Record<string, unknown> = {}

  const background = style?.background as Record<string, unknown> | undefined
  const sceneEnv = scene.environment as Record<string, unknown>
  const bgType = background?.type
  if (bgType === 'office') {
    sceneEnv.location_type = 'a corporate office environment, the background should be fuzzy, so that the subject is central in the image and the background is blurred out.'
  } else if (bgType === 'neutral') {
    sceneEnv.location_type = 'a studio with a neutral background'
    const bgColor = background?.color
    if (bgColor) {
      sceneEnv.color_palette = [bgColor]
    }
  } else if (bgType === 'gradient') {
    sceneEnv.location_type = 'a studio with a gradient background going from light to dark'
    const gradientColor = background?.color
    if (gradientColor) {
      sceneEnv.color_palette = [gradientColor]
    }
  } else if (bgType === 'custom') {
    sceneEnv.location_type = 'custom background from attached image. Pls the subject in the background taking into account correct placement and orientation as id the subject fits correctly in the environment.'
  }
  if (background?.prompt) {
    sceneEnv.description = background.prompt
  }

  const branding = style?.branding as Record<string, unknown> | undefined
  const brandingType = branding?.type
  const brandingPosition = branding?.position
  if (brandingType === 'include') {
    let placement = 'tastefully placed'
    if (brandingPosition === 'background') placement = 'subtly integrated into the background. It can be like framed and hanging on the wall. Ensure the position and alignment fits well with the wall it is hanging on'
    if (brandingPosition === 'clothing') placement = 'incorporated into the clothing or accessories. Ensure that the logo is positioned outside of overlapping elements, like napels'
    if (brandingPosition === 'elements') placement = 'included as design elements in the composition, preferable on a background wall, a window, or as a frame on the wall. Ensure the branding is inline with the background, eg if the background is fuzzy, also the branding should be fuzzy. Ensure the logo does not just fly in the air. That doesnt make sense. '
    sceneEnv.branding = `tasteful brand logo included from the attached image, ${placement}. Ensure you do not includ the 'logo' tag in the final picture.`
  }
  if (brandingType === 'exclude') sceneEnv.branding = 'no brand marks'

  const styleSettings = style?.style as Record<string, unknown> | undefined
  const preset = styleSettings?.preset
  if (preset === 'corporate') {
    scene.mood = 'professional, confident'
    rendering_intent.photorealism = 'high'
  } else if (preset === 'casual') {
    scene.mood = 'approachable, relaxed'
  } else if (preset === 'cinematic') {
    scene.mood = 'cinematic, refined'
  }

  const clothing = style?.clothing as Record<string, unknown> | undefined
  if (clothing?.style) {
    const subjectWardrobe = { 
      style: clothing.style,
      details: clothing.details
    } as Record<string, unknown>
    subject.wardrobe = subjectWardrobe
    if (clothing.accessories && Array.isArray(clothing.accessories) && clothing.accessories.length > 0) {
      subjectWardrobe.accessories = clothing.accessories
    }
    if (clothing.colors) {
      const colorParts = []
      const colors = clothing.colors as Record<string, unknown>
      if (colors.topCover) colorParts.push(`top cover: ${colors.topCover}`)
      if (colors.topBase) colorParts.push(`base layer: ${colors.topBase}`)
      if (colors.bottom) colorParts.push(`bottom: ${colors.bottom}`)
      if (colorParts.length > 0) {
        subjectWardrobe.color_palette = colorParts
      }
    }
  }

  const expression = style?.expression as Record<string, unknown> | undefined
  if (expression?.type) {
    subject.pose = { ...(subject.pose as Record<string, unknown> || {}), expression: expression.type }
  }

  const lightingStyle = style?.lighting as Record<string, unknown> | undefined
  const lightType = lightingStyle?.type
  if (lightType === 'natural') {
    lighting.key = 'soft window key light'
    lighting.fill = 'gentle fill opposite window'
    lighting.quality = 'soft'
  } else if (lightType === 'studio') {
    lighting.key = 'large softbox key slightly above eye level'
    lighting.fill = 'secondary softbox or reflector ~1 stop under key'
    lighting.quality = 'soft, controlled'
  } else if (lightType === 'soft') {
    lighting.quality = 'very soft, diffuse'
  } else if (lightType === 'dramatic') {
    lighting.quality = 'soft key with higher contrast; controlled spill'
  }

  framing_composition.shot_type = framing_composition.shot_type || 'head-and-shoulders portrait, with ample headroom and negative space above their head, ensuring the top of their head is not cropped'
  framing_composition.orientation = framing_composition.orientation || 'vertical'
  framing_composition.background_separation = framing_composition.background_separation || 'soft'

  camera.sensor = 'full-frame mirrorless'
  camera.lens = { focal_length_mm: 85, type: 'prime', character: 'neutral rendering, low distortion' }
  camera.settings = { aperture: 'f/2.8', shutter_speed: '1/200', iso: 200, white_balance: 'auto', focus: 'eye-AF' }

  rendering_intent.texture = 'retain fabric weave and hair strands'

  const structured: Record<string, unknown> = {}
  const hasKeys = (obj: unknown): boolean => typeof obj === 'object' && obj !== null && Object.keys(obj as Record<string, unknown>).length > 0
  if (hasKeys(sceneEnv)) {
    if (!hasKeys(scene)) scene.environment = { ...sceneEnv }
    structured.scene = { ...scene }
  } else if (hasKeys(scene)) {
    structured.scene = { ...scene }
  }
  if (hasKeys(subject)) structured.subject = subject
  if (hasKeys(framing_composition)) structured.framing_composition = framing_composition
  if (hasKeys(camera)) structured.camera = camera
  if (hasKeys(lighting)) structured.lighting = lighting
  if (hasKeys(rendering_intent)) structured.rendering_intent = rendering_intent
  if (hasKeys(post_processing)) structured.post_processing = post_processing

  if (basePrompt) {
    structured.notes = basePrompt
  }

  const preface = 'Follow the JSON below to generate a professional headshot. Only use specified fields; otherwise use sensible defaults.'
  return preface + '\n' + JSON.stringify(structured)
}


