'use client'

import StyleFormPage from '@/components/styles/StyleFormPage'

export default function EditTeamContextPage() {
  return (
    <StyleFormPage
      mode="edit"
      contextType="team"
      backUrl="/app/styles/team"
      scope="pro"
      title="Edit Team Photo Style"
      subtitle="Customize your team photo style settings"
    />
  )
}
