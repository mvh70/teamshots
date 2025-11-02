'use client'

import StyleFormPage from '@/components/styles/StyleFormPage'

export default function EditPersonalContextPage() {
  return (
    <StyleFormPage
      mode="edit"
      contextType="personal"
      backUrl="/app/styles/personal"
      scope="individual"
      title="Edit Personal Photo Style"
      subtitle="Customize your personal photo style settings"
    />
  )
}
