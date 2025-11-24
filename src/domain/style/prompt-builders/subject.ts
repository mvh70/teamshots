const identity = {
  source: 'Attached is a composite of selfies. Each selfie is labeled with a clear label (SUBJECT1-SELFIE1, SUBJECT1-SELFIE2, etc.) for easy reference.',
  task: 'You must synthesize a single, photorealistic, and coherent identity from these images. For this take the selfie that resembles the most the actual pose, and use this as a basis. Use the other selfies to reinforce the 3D structure and facial detail. Do not average or blend features in a way that creates a new person.',
  face: ['Do not alter the fundamental facial structure, and carefully check the following features:',
        '- form of the eyes, nose, mouth, ears, eyebrows, cheeks, chin',
        '- color of the eyes, skintone and hair color',
        '- unique skin details like moles, scars, or freckles visible in the source selfies',
        '- any other unique features, like glasses, hair style, etc. that are visible in the source selfies',
        ],
  accessories: ['If the person wears glasses in the selfies, add exactly the same glasses to the resulting image',
                'If the person has earrings or a watch in the selfies, add exactly the same earrings or watch to the resulting image',
  ],
} as const

const rendering = {
  identity: 'retain the identity of the person in the selfies as much as possible, do not beautify the resulting image, it should resemble as much as possible the selfies in the composite',
  texture: 'retain hair detail, facial features like wrinkles, freckles, moles, etc., and glasses',
  cleanliness: 'no text, labels, borders, or UI artifacts',
  framing: 'the original selfies of the subject should not be shown in the final image',
  proportions: 'pay special attention to size of the head compared to the rest of the body - maintain realistic head-to-body proportions',
  quality: 'Make the image as realistic as possible, with all the natural imperfections. Add realistic effects, taken from the selfies, like some hairs sticking out',

} as const

export const subject = {
  identity,
  rendering
} as const

