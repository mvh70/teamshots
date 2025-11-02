'use client'

import StyleFormPage from '@/components/styles/StyleFormPage'

export default function CreatePersonalContextPage() {
  return (
    <StyleFormPage
      mode="create"
      contextType="personal"
      backUrl="/app/styles/personal"
      scope="individual"
      title="Create Personal Photo Style"
      subtitle="Create a new personal photo style for your generations"
    />
  )
}
