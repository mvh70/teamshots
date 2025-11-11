const identity = {
  source: 'composite selfies',
  immutable_features:
    'The images in the selfies show the exact same individual. Your primary task is to synthesize a single, photorealistic, and coherent identity from these images. Do not average or blend features in a way that creates a new person. Pay special attention to facial features, and skin tone. Use the selfies to understand the 3D structure of the face from different angles. The final generated person must be clearly identifiable as the person. Do not alter the fundamental facial structure, eye color, eye shape, nose shape, or unique skin details like moles, scars, or freckles visible in the source selfies.',
  reference_roles: [
    {
      reference: 'subject1-selfies',
      label: 'Reference – Main Likeness',
      instructions: [
        'From all provided selfies, choose the shot that best matches the requested pose and lighting as the primary likeness. Use the remaining selfies only to reinforce 3D structure and facial detail, and do not display the raw selfies in the final image.'
      ]
    }
  ] as const,
  identity_guidelines: [
    'All generated results must clearly depict the same individual from the provided selfies.',
    'Prioritize natural, photorealistic rendering quality matching the supplied source imagery.',
    'Integrate expression and lighting cues from supporting references without deviating from the core identity.'
  ] as const
} as const

const rendering = {
  texture: 'retain fabric weave and hair detail and facial features like wrinkles, freckles, moles, etc.',
  cleanliness: 'no text, labels, borders, or UI artifacts',
  framing: 'the original selfies of the subject should not be shown in the final image',
  quality: 'high resolution, print-ready'
} as const

export const subject = {
  identity,
  rendering
} as const

