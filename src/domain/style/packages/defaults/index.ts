import { ShotTypeValue, ExpressionType } from '@/types/photo-style'
import type {
  ApertureSetting,
  FocalLengthSetting,
  LightingQualitySetting,
  ShutterSpeedSetting
} from '../../elements/shot-type/types'
import { AspectRatioId } from '../../elements/aspect-ratio/config'
import type { PoseType } from '../../elements/pose/types'

type LightingDirection =
  | 'front'
  | 'front-45'
  | 'side'
  | 'back'
  | 'top'
  | 'multi'
  | 'creative'

type TimeOfDay = 'sunrise' | 'morning' | 'midday' | 'afternoon' | 'golden_hour' | 'sunset' | 'blue_hour'
type Platform = 'linkedin' | 'instagram_feed' | 'instagram_story' | 'website_hero' | 'print_8x10' | 'profile_picture'

export interface StandardPresetDefaults {
  shotType: ShotTypeValue
  aspectRatio?: AspectRatioId
  focalLength: FocalLengthSetting
  aperture: ApertureSetting
  shutterSpeed: ShutterSpeedSetting
  iso: number
  orientation: 'vertical' | 'horizontal' | 'either'
  timeOfDay?: TimeOfDay
  platform?: Platform
  lighting: {
    quality: LightingQualitySetting
    direction: LightingDirection
    setupNotes?: string[]
    colorTempKelvin?: number
  }
  environment: {
    description: string
    distanceFromSubjectFt?: number
    notes?: string[]
  }
  composition: {
    framingNotes: string[]
    headroomPercent?: number
    lookingSpaceNotes?: string[]
    groundNotes?: string[]
  }
  pose: {
    type: PoseType
    notes?: string[]
  }
  expression?: ExpressionType
  promptTemplate: string
}

export interface StandardPresetConfig {
  id: string
  label: string
  useCases: string[]
  defaults: StandardPresetDefaults
  summary?: string
}

export const CORPORATE_HEADSHOT: StandardPresetConfig = {
  id: 'corporate-headshot',
  label: 'Corporate Headshot',
  useCases: ['LinkedIn', 'Company website', 'Professional profiles', 'Business cards'],
  summary: 'Classic corporate portrait optimised for professional platforms.',
  defaults: {
    shotType: 'medium-close-up',
    aspectRatio: '4:5',
    focalLength: '85mm',
    aperture: 'f/4.0',
    shutterSpeed: '1/200',
    iso: 100,
    orientation: 'vertical',
    timeOfDay: 'midday',
    platform: 'linkedin',
    lighting: {
      quality: 'soft-diffused',
      direction: 'front-45',
      setupNotes: ['Softbox (3x4ft or larger) with reflector opposite'],
      colorTempKelvin: 5500
    },
    environment: {
      description: 'Gray seamless backdrop or blurred office environment',
      distanceFromSubjectFt: 6,
      notes: ['Keep subject 6-8 feet from background to maximise falloff.']
    },
    composition: {
      framingNotes: ['Medium close-up from head to mid-chest', 'Centered or slight rule of thirds'],
      headroomPercent: 15,
      lookingSpaceNotes: ['Minimal looking space; eyes near top third.']
    },
    pose: {
      type: 'slimming_three_quarter',
      notes: ['Chin extended forward and slightly down for jaw definition.']
    },
    expression: 'genuine_smile',
    promptTemplate:
      'Professional corporate headshot, medium close-up from head to mid-chest, shot on an 85mm lens at f/4.0 with soft diffused lighting from a 45° angle and subtle reflector fill. Background is a soft gray seamless or blurred office interior with the subject separated by 6-8 feet. Body angled 25° to camera, front shoulder relaxed, face turned slightly toward light, chin extended forward and down, genuine warm smile, vertical portrait orientation.'
  }
}

export const EXECUTIVE_PORTRAIT: StandardPresetConfig = {
  id: 'executive-portrait',
  label: 'Executive Portrait',
  useCases: ['C-suite', 'Board members', 'Annual reports'],
  summary: 'Authoritative portrait with controlled studio lighting.',
  defaults: {
    shotType: 'medium-shot',
    aspectRatio: '3:4',
    focalLength: '105mm',
    aperture: 'f/4.0',
    shutterSpeed: '1/200',
    iso: 100,
    orientation: 'vertical',
    timeOfDay: 'midday',
    platform: 'linkedin',
    lighting: {
      quality: 'studio-softbox',
      direction: 'front-45',
      setupNotes: ['Softbox or beauty dish key with minimal fill to preserve shadow'],
      colorTempKelvin: 5500
    },
    environment: {
      description: 'Dark gray backdrop or upscale office interior',
      distanceFromSubjectFt: 6,
      notes: ['Keep background understated to emphasise authority.']
    },
    composition: {
      framingNotes: ['Medium shot to waist level for commanding presence', 'Rule of thirds alignment'],
      headroomPercent: 12
    },
    pose: {
      type: 'power_cross',
      notes: ['Arms crossed or hands visible to project control and confidence.']
    },
    expression: 'neutral_serious',
    promptTemplate:
      'Executive portrait, medium shot from head to waist on a 105mm lens at f/4.5. Controlled studio lighting at 45° with subtle shadow sculpting, dark gray backdrop. Subject stands square or slightly angled with strong shoulders, arms crossed confidently, chin level, authoritative expression. Vertical orientation with rule-of-thirds composition for leadership presence.'
  }
}

export const LINKEDIN_PROFILE: StandardPresetConfig = {
  id: 'linkedin-profile',
  label: 'LinkedIn Profile',
  useCases: ['LinkedIn', 'Professional social media', 'Online networking'],
  summary: 'Approachable portrait tuned for LinkedIn ratio and feed.',
  defaults: {
    shotType: 'medium-close-up',
    aspectRatio: '4:5',
    focalLength: '85mm',
    aperture: 'f/4.0',
    shutterSpeed: '1/200',
    iso: 200,
    orientation: 'vertical',
    timeOfDay: 'midday',
    platform: 'linkedin',
    lighting: {
      quality: 'soft-diffused',
      direction: 'front-45',
      setupNotes: ['Window light with reflector or softbox for fill'],
      colorTempKelvin: 5500
    },
    environment: {
      description: 'Blurred professional setting or tasteful neutral background',
      distanceFromSubjectFt: 6,
      notes: ['Background blur should remain recognisable but unobtrusive.']
    },
    composition: {
      framingNotes: ['Centered or slight offset; maintain 15-20% headroom'],
      headroomPercent: 18
    },
    pose: {
      type: 'slimming_three_quarter',
      notes: ['Warm genuine smile conveying approachability.']
    },
    expression: 'genuine_smile',
    promptTemplate:
      'LinkedIn profile portrait, medium close-up from head to mid-chest using an 85mm lens at f/4.0. Soft natural window light from 45° with reflector fill, blurred professional background. Body angled 20° with relaxed shoulders, slight friendly head tilt, warm approachable smile. Vertical 4:5 orientation optimised for LinkedIn feeds.'
  }
}

export const FULL_LENGTH_BUSINESS: StandardPresetConfig = {
  id: 'full-length-business',
  label: 'Full-Length Business Portrait',
  useCases: ['Professional websites', 'Marketing materials', 'Full outfit display'],
  summary: 'Full-length corporate portrait with confident stance.',
  defaults: {
    shotType: 'full-length',
    aspectRatio: '2:3',
    focalLength: '85mm',
    aperture: 'f/5.6',
    shutterSpeed: '1/200',
    iso: 150,
    orientation: 'vertical',
    timeOfDay: 'midday',
    platform: 'website_hero',
    lighting: {
      quality: 'soft-diffused',
      direction: 'front-45',
      setupNotes: ['Large softbox or diffused natural light for even coverage'],
      colorTempKelvin: 5500
    },
    environment: {
      description: 'Blurred office or modern corporate setting',
      distanceFromSubjectFt: 8,
      notes: ['Ensure 20% breathing room around subject; include ground beneath feet.']
    },
    composition: {
      framingNotes: ['Full body visible with breathing room top and bottom', 'Professional posture emphasised'],
      headroomPercent: 12,
      groundNotes: ['Show a touch of floor for grounding.']
    },
    pose: {
      type: 'casual_confident',
      notes: ['Front knee slightly bent; alternate pose with arms crossed acceptable.']
    },
    expression: 'soft_smile',
    promptTemplate:
      'Full-length business portrait, head to toe with ample breathing room, shot on an 85mm lens at f/5.6. Soft diffused lighting from 45° maintains even illumination. Blurred office background, subject angled 30° to camera with weight on back foot, front shoulder relaxed, one hand in pocket or arms crossed, confident professional smile, vertical composition showing the full outfit.'
  }
}

export const TEAM_GROUP: StandardPresetConfig = {
  id: 'team-group',
  label: 'Team / Group Portrait',
  useCases: ['Company team pages', 'Department photos', 'Partners'],
  summary: 'Balanced multi-person portrait with even lighting.',
  defaults: {
    shotType: 'medium-shot',
    aspectRatio: '16:9',
    focalLength: '50mm',
    aperture: 'f/5.6',
    shutterSpeed: '1/160',
    iso: 150,
    orientation: 'horizontal',
    timeOfDay: 'midday',
    platform: 'website_hero',
    lighting: {
      quality: 'soft-diffused',
      direction: 'multi',
      setupNotes: ['Soft even lighting from front or dual 45° sources to cover group evenly'],
      colorTempKelvin: 5500
    },
    environment: {
      description: 'Neutral backdrop or collaborative office environment',
      distanceFromSubjectFt: 8,
      notes: ['Provide staggered heights and comfortable spacing to create connection.']
    },
    composition: {
      framingNotes: ['Balanced arrangement with staggered heights', 'Keep group tight with small separations'],
      lookingSpaceNotes: ['Ensure equal looking direction or consistent gaze for cohesion.']
    },
    pose: {
      type: 'classic_corporate',
      notes: ['Encourage light physical connection (touching shoulders) for unity.']
    },
    expression: 'genuine_smile',
    promptTemplate:
      'Professional team portrait of multiple people, medium shot on a 50mm lens at f/5.6, evenly lit from the front with soft diffusion. Subjects arranged in a staggered triangular formation, relaxed shoulders, slight body angle variations, genuine cohesive smiles, horizontal 3:2 or 16:9 orientation for web hero usage.'
  }
}

export const FASHION_EDITORIAL: StandardPresetConfig = {
  id: 'fashion-editorial',
  label: 'Fashion Editorial',
  useCases: ['Magazines', 'Lookbooks', 'High fashion portfolios'],
  summary: 'Creative fashion portrait emphasising dramatic pose and lighting.',
  defaults: {
    shotType: 'three-quarter',
    aspectRatio: '3:4',
    focalLength: '135mm',
    aperture: 'f/2.8',
    shutterSpeed: '1/250',
    iso: 150,
    orientation: 'vertical',
    timeOfDay: 'golden_hour',
    lighting: {
      quality: 'hard-direct',
      direction: 'creative',
      setupNotes: ['Directional beauty dish, natural side light, or creative mixed sources'],
      colorTempKelvin: 5200
    },
    environment: {
      description: 'High-end studio or location with editorial styling',
      notes: ['Use minimal background elements to maximise subject impact.']
    },
    composition: {
      framingNotes: ['Asymmetrical composition with strong lines and negative space'],
      lookingSpaceNotes: ['Embrace unconventional framing to heighten drama.']
    },
    pose: {
      type: 'slimming_three_quarter',
      notes: ['Encourage angular limbs and fashion-forward body language.']
    },
    expression: 'neutral_serious',
    promptTemplate:
      'Fashion editorial portrait with dramatic styling, three-quarter framing on a 135mm lens at f/2.8. Directional creative lighting highlighting wardrobe texture, minimalist studio or high-fashion location. Subject angles body 45° with hip shift, asymmetrical shoulders, angular arm positioning, intense fashion expression, vertical composition emphasising elongated lines.'
  }
}

export const LIFESTYLE_CASUAL: StandardPresetConfig = {
  id: 'lifestyle-casual',
  label: 'Lifestyle / Casual',
  useCases: ['Personal branding', 'Blog content', 'Authentic lifestyle imagery'],
  summary: 'Relaxed environmental portrait with candid energy.',
  defaults: {
    shotType: 'medium-shot',
    aspectRatio: '3:2',
    focalLength: '50mm',
    aperture: 'f/2.8',
    shutterSpeed: '1/250',
    iso: 250,
    orientation: 'either',
    timeOfDay: 'afternoon',
    lighting: {
      quality: 'soft-diffused',
      direction: 'front-45',
      setupNotes: ['Golden hour outdoor light or window light with reflector'],
      colorTempKelvin: 4800
    },
    environment: {
      description: 'Real-life context such as café, home interior, or outdoor scene',
      notes: ['Allow contextual elements to share story; maintain clean aesthetics.']
    },
    composition: {
      framingNotes: ['Natural, candid framing with breathable negative space']
    },
    pose: {
      type: 'casual_confident',
      notes: ['Encourage real interaction (hold coffee, adjust hair) for authenticity.']
    },
    expression: 'genuine_smile',
    promptTemplate:
      'Lifestyle portrait in a natural environment, medium framing on a 50mm lens at f/2.8. Warm natural lighting (window or golden hour) with contextual background elements. Subject casually angled 20-30° with relaxed shoulders, hand in pocket or holding an object, authentic candid expression. Orientation may be vertical or horizontal, emphasising personality.'
  }
}

export const INSTAGRAM_SOCIAL: StandardPresetConfig = {
  id: 'instagram-social',
  label: 'Instagram / Social Media',
  useCases: ['Instagram feed', 'Social media content', 'Personal branding'],
  summary: 'Curated yet natural portrait tuned for social media ratios.',
  defaults: {
    shotType: 'medium-close-up',
    aspectRatio: '4:5',
    focalLength: '85mm',
    aperture: 'f/2.8',
    shutterSpeed: '1/200',
    iso: 250,
    orientation: 'vertical',
    timeOfDay: 'golden_hour',
    platform: 'instagram_feed',
    lighting: {
      quality: 'soft-diffused',
      direction: 'front-45',
      setupNotes: ['Golden hour light or soft window illumination'],
      colorTempKelvin: 5000
    },
    environment: {
      description: 'Aesthetic lifestyle background with soft tonal palette',
      notes: ['Leave negative space for text overlays when needed.']
    },
    composition: {
      framingNotes: ['Centered subject with intentional negative space', 'Allow room for graphic overlays']
    },
    pose: {
      type: 'approachable_lean',
      notes: ['Capture warm relatable energy; maintain modern styling.']
    },
    expression: 'genuine_smile',
    promptTemplate:
      'Instagram-ready portrait, medium close-up on an 85mm lens at f/2.8, soft golden-hour lighting or diffused window light. Aesthetic background with gentle blur, subject centered with slight body angle and relaxed posture, genuine warm expression, vertical 4:5 aspect ratio with negative space for social media text overlays.'
  }
}

export const DATING_PROFILE: StandardPresetConfig = {
  id: 'dating-profile',
  label: 'Dating Profile Portrait',
  useCases: ['Dating apps', 'Personal introduction imagery'],
  summary: 'Warm approachable portrait with lifestyle context.',
  defaults: {
    shotType: 'medium-close-up',
    aspectRatio: '4:5',
    focalLength: '85mm',
    aperture: 'f/2.8',
    shutterSpeed: '1/200',
    iso: 250,
    orientation: 'vertical',
    timeOfDay: 'afternoon',
    lighting: {
      quality: 'soft-diffused',
      direction: 'front-45',
      setupNotes: ['Soft natural light to highlight personality'],
      colorTempKelvin: 5200
    },
    environment: {
      description: 'Lifestyle background that hints at interests or hobbies',
      notes: ['Keep backdrop authentic but not cluttered.']
    },
    composition: {
      framingNotes: ['Face clearly visible, friendly engagement with camera']
    },
    pose: {
      type: 'casual_confident',
      notes: ['Relaxed posture showing open approachable body language.']
    },
    expression: 'genuine_smile',
    promptTemplate:
      'Dating profile portrait, medium close-up on an 85mm lens at f/2.8 with soft natural lighting. Lifestyle background reflecting interests, body angled 20° to camera, one hand in pocket, relaxed shoulders, confident but approachable posture, genuine warm smile, vertical 4:5 orientation.'
  }
}

export const FAMILY_PORTRAIT: StandardPresetConfig = {
  id: 'family-portrait',
  label: 'Family Portrait',
  useCases: ['Family photos', 'Holiday cards', 'Home display'],
  summary: 'Warm family portrait with natural connection.',
  defaults: {
    shotType: 'full-length',
    aspectRatio: '3:2',
    focalLength: '50mm',
    aperture: 'f/5.6',
    shutterSpeed: '1/200',
    iso: 250,
    orientation: 'horizontal',
    timeOfDay: 'afternoon',
    platform: 'print_8x10',
    lighting: {
      quality: 'soft-diffused',
      direction: 'front',
      setupNotes: ['Soft natural light or lightly diffused flash to cover group evenly'],
      colorTempKelvin: 5500
    },
    environment: {
      description: 'Home, park, or studio background with minimal distractions',
      notes: ['Arrange subjects in triangular grouping to show connection.']
    },
    composition: {
      framingNotes: ['Balanced arrangement with varied heights', 'Encourage touch and closeness for warmth']
    },
    pose: {
      type: 'classic_corporate',
      notes: ['Ensure natural physical connection—hands on shoulders, arms around family members.']
    },
    expression: 'genuine_smile',
    promptTemplate:
      'Family portrait of multiple people, full-length on a 50mm lens at f/5.6 with soft natural lighting. Subjects arranged in a triangular grouping with varied heights, close physical connection, relaxed shoulders, genuine warm smiles, horizontal 3:2 composition capturing authentic family warmth.'
  }
}

export const ACTOR_HEADSHOT: StandardPresetConfig = {
  id: 'actor-headshot',
  label: 'Actor Headshot',
  useCases: ['Casting', 'Agency submissions', 'Theatrical representation'],
  summary: 'Tight headshot emphasising expression and eye contact.',
  defaults: {
    shotType: 'close-up',
    aspectRatio: '3:4',
    focalLength: '85mm',
    aperture: 'f/4.0',
    shutterSpeed: '1/200',
    iso: 150,
    orientation: 'vertical',
    timeOfDay: 'midday',
    platform: 'print_8x10',
    lighting: {
      quality: 'soft-diffused',
      direction: 'front-45',
      setupNotes: ['Softbox or window light with catch-light emphasis'],
      colorTempKelvin: 5500
    },
    environment: {
      description: 'Neutral or muted background with subtle texture',
      notes: ['Maintain tight framing from below shoulders to top of head.']
    },
    composition: {
      framingNotes: ['Minimal headroom; focus on facial expression and eyes']
    },
    pose: {
      type: 'classic_corporate',
      notes: ['Chin extended forward and down to sharpen jawline; maintain strong eye contact.']
    },
    expression: 'neutral_serious',
    promptTemplate:
      'Actor headshot, tight framing from just below shoulders to top of head on an 85mm lens at f/4.0. Soft lighting from 45° with defined catch light, neutral muted background, shoulders relaxed with minimal head tilt, chin extended forward and down, strong eye contact with authentic expression, vertical 8x10-style composition.'
  }
}

export const REAL_ESTATE_AGENT: StandardPresetConfig = {
  id: 'real-estate-agent',
  label: 'Real Estate Agent Portrait',
  useCases: ['Business cards', 'Marketing materials', 'Advertisements'],
  summary: 'High-energy portrait with bright confident presence.',
  defaults: {
    shotType: 'medium-shot',
    aspectRatio: '2:3',
    focalLength: '85mm',
    aperture: 'f/4.0',
    shutterSpeed: '1/200',
    iso: 150,
    orientation: 'vertical',
    timeOfDay: 'midday',
    platform: 'profile_picture',
    lighting: {
      quality: 'studio-softbox',
      direction: 'front',
      setupNotes: ['Bright even key light to convey trust and energy'],
      colorTempKelvin: 5500
    },
    environment: {
      description: 'Clean white/gray backdrop or upscale property setting',
      notes: ['Keep background bright and uncluttered for marketing versatility.']
    },
    composition: {
      framingNotes: ['Centered composition with bold presence', 'Allow 15-20% headroom']
    },
    pose: {
      type: 'power_cross',
      notes: ['Alternate pose with hands on hips or one hand in pocket.']
    },
    expression: 'genuine_smile',
    promptTemplate:
      'Real estate agent portrait, medium framing on an 85mm lens at f/4.0 with bright even studio lighting. Clean gray or property-inspired backdrop, subject angled 20° with confident stance, arms crossed or one hand on hip, big genuine trustworthy smile, vertical orientation ideal for marketing collateral.'
  }
}

export const UNIVERSAL_PRESET: StandardPresetConfig = {
  id: 'universal-standard',
  label: 'Universal Portrait Standard',
  useCases: ['General default'],
  summary: 'Balanced universal portrait configuration for most scenarios.',
  defaults: {
    shotType: 'medium-close-up',
    aspectRatio: '3:4',
    focalLength: '85mm',
    aperture: 'f/4.0',
    shutterSpeed: '1/200',
    iso: 150,
    orientation: 'vertical',
    timeOfDay: 'midday',
    lighting: {
      quality: 'soft-diffused',
      direction: 'front-45',
      setupNotes: ['Soft key with reflector fill'],
      colorTempKelvin: 5400
    },
    environment: {
      description: 'Neutral blurred background kept 6-8 feet behind subject'
    },
    composition: {
      framingNotes: ['Eyes on upper third, minimal looking space', 'Use vertical portrait orientation']
    },
    pose: {
      type: 'slimming_three_quarter',
      notes: ['Chin out and down; adjust pose to suit context.']
    },
    expression: 'genuine_smile',
    promptTemplate:
      'Balanced professional portrait, medium close-up on an 85mm lens at f/4.0 with soft diffused 45° lighting. Neutral blurred background, subject angled 20-30° with front shoulder relaxed, head gently turned toward light, chin extended forward and down, friendly approachable expression, vertical composition appropriate for most professional uses.'
  }
}

export const STANDARD_PRESETS: Record<string, StandardPresetConfig> = {
  [CORPORATE_HEADSHOT.id]: CORPORATE_HEADSHOT,
  [EXECUTIVE_PORTRAIT.id]: EXECUTIVE_PORTRAIT,
  [LINKEDIN_PROFILE.id]: LINKEDIN_PROFILE,
  [FULL_LENGTH_BUSINESS.id]: FULL_LENGTH_BUSINESS,
  [TEAM_GROUP.id]: TEAM_GROUP,
  [FASHION_EDITORIAL.id]: FASHION_EDITORIAL,
  [LIFESTYLE_CASUAL.id]: LIFESTYLE_CASUAL,
  [INSTAGRAM_SOCIAL.id]: INSTAGRAM_SOCIAL,
  [DATING_PROFILE.id]: DATING_PROFILE,
  [FAMILY_PORTRAIT.id]: FAMILY_PORTRAIT,
  [ACTOR_HEADSHOT.id]: ACTOR_HEADSHOT,
  [REAL_ESTATE_AGENT.id]: REAL_ESTATE_AGENT,
  [UNIVERSAL_PRESET.id]: UNIVERSAL_PRESET
}

export const DEFAULT_STANDARD_PRESET_ID = CORPORATE_HEADSHOT.id

export function getStandardPreset(presetId?: string): StandardPresetConfig {
  const preset = presetId ? STANDARD_PRESETS[presetId] : undefined
  const selected = preset || STANDARD_PRESETS[DEFAULT_STANDARD_PRESET_ID]
  return JSON.parse(JSON.stringify(selected)) as StandardPresetConfig
}

