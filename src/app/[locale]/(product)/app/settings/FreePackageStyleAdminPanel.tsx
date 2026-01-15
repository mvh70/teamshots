'use client'

import SettingsCard from '@/components/ui/SettingsCard'
import StyleForm from '@/components/styles/StyleForm'

export default function FreePackageStyleAdminPanel() {
  return (
    <SettingsCard
      title="Free Package Photo Style"
      description="Design the default style used for free users. This is enforced for free plan generations."
    >
      <StyleForm
        mode="edit"
        contextType="freePackage"
        backUrl="/app/settings"
        scope="freePackage"
        showButtons={false}
        hideFormCard={true}
        hideMessages={true}
      />
    </SettingsCard>
  )
}


