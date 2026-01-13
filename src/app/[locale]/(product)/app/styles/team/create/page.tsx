'use client'

import StyleFormPage from '@/components/styles/StyleFormPage'

export default function CreateTeamContextPage() {
  return (
    <StyleFormPage
      mode="create"
      contextType="team"
      backUrl="/app/styles/team"
      scope="pro"
      title="Create Team Photo Style"
      subtitle="Create a new team photo style for consistent team photo generation"
    />
  )
}
