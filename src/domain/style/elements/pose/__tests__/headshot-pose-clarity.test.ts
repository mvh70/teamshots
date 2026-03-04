import { ALL_POSE_IDS, POSE_TEMPLATES } from '../config'

const HEADSHOT_ACTIVE_POSES = [
  'classic_corporate',
  'slimming_three_quarter',
  'power_cross',
  'candid_over_shoulder',
  'seated_engagement',
] as const

const AMBIGUOUS_PATTERN = /\b(or|either)\b|\/|invisible/i

describe('headshot pose clarity', () => {
  it('keeps headshot package poses deterministic and non-contradictory', () => {
    for (const poseId of HEADSHOT_ACTIVE_POSES) {
      const template = POSE_TEMPLATES[poseId]
      expect(template).toBeDefined()

      const valuesToCheck = [
        template.pose.body_angle,
        template.pose.head_position,
        template.pose.chin_technique,
        template.pose.shoulders,
        template.pose.weight_distribution,
        template.pose.arms,
        template.prompt_instructions,
      ]

      for (const value of valuesToCheck) {
        expect(value).not.toMatch(AMBIGUOUS_PATTERN)
      }
    }
  })

  it('keeps all pose templates free of ambiguous branch instructions', () => {
    for (const poseId of ALL_POSE_IDS) {
      const template = POSE_TEMPLATES[poseId]
      expect(template).toBeDefined()

      const valuesToCheck = [
        template.pose.body_angle,
        template.pose.head_position,
        template.pose.chin_technique,
        template.pose.shoulders,
        template.pose.weight_distribution,
        template.pose.arms,
        template.prompt_instructions,
      ]

      for (const value of valuesToCheck) {
        expect(value).not.toMatch(AMBIGUOUS_PATTERN)
      }
    }
  })
})
