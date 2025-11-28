'use client'

import BackHeader from '@/components/common/BackHeader'
import StyleForm from '@/components/styles/StyleForm'

type Mode = 'create' | 'edit'
type ContextType = 'personal' | 'team' | 'freePackage'
type Scope = 'individual' | 'pro' | 'freePackage'

interface StyleFormPageProps {
  mode: Mode
  contextType: ContextType
  scope: Scope
  backUrl: string
  title: string
  subtitle?: string
}

export default function StyleFormPage({ mode, contextType, scope, backUrl, title, subtitle }: StyleFormPageProps) {
  return (
    <div className="space-y-8 pb-8">
      <BackHeader backUrl={backUrl} title={title} subtitle={subtitle} />
      <StyleForm
        mode={mode}
        contextType={contextType}
        backUrl={backUrl}
        scope={scope}
        showButtons={false}
      />
    </div>
  )
}


