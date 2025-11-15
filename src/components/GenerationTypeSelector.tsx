'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { PRICING_CONFIG } from '@/config/pricing'
import { Grid } from '@/components/ui'

interface GenerationTypeSelectorProps {
  uploadedPhotoKey: string
  onTypeSelected: (type: 'personal' | 'team') => void
  userCredits: {
    individual: number
    team: number
  }
  hasTeamAccess: boolean
  teamName?: string
}

export default function GenerationTypeSelector({
  uploadedPhotoKey,
  onTypeSelected,
  userCredits,
  hasTeamAccess,
  teamName
}: GenerationTypeSelectorProps) {
  const t = useTranslations('generation')
  const [selectedType, setSelectedType] = useState<'personal' | 'team' | null>(null)

  const handleContinue = () => {
    if (selectedType) {
      onTypeSelected(selectedType)
    }
  }

  const canUsePersonal = userCredits.individual >= PRICING_CONFIG.credits.perGeneration
  const canUseTeam = hasTeamAccess && userCredits.team >= PRICING_CONFIG.credits.perGeneration

  return (
    <div className="space-y-6">
      {/* Photo Preview */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          {t('typeSelection.title')}
        </h1>
        <p className="text-sm text-gray-600 mb-4">
          {t('typeSelection.subtitle')}
        </p>
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Photo uploaded</p>
            <p className="text-xs text-gray-500 font-mono">{uploadedPhotoKey}</p>
          </div>
        </div>
      </div>

      {/* Generation Type Selection */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          {t('typeSelection.howToUse')}
        </h2>
        
        <Grid cols={{ mobile: 1, tablet: 2 }} gap="md">
          {/* Personal Use Option */}
          <div
            className={`relative border-2 rounded-lg p-6 cursor-pointer transition-all ${
              selectedType === 'personal'
                ? 'border-brand-primary bg-brand-primary-light'
                : 'border-gray-200 hover:border-gray-300'
            } ${!canUsePersonal ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => canUsePersonal && setSelectedType('personal')}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="generationType"
                checked={selectedType === 'personal'}
                onChange={() => setSelectedType('personal')}
                disabled={!canUsePersonal}
                className="mt-1"
              />
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {t('typeSelection.personal.title')}
                </h3>
                <ul className="text-sm text-gray-600 space-y-1 mb-4">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-brand-secondary" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {t('typeSelection.personal.fullControl')}
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-brand-secondary" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {t('typeSelection.personal.private')}
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-brand-secondary" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {t('typeSelection.personal.anyStyle')}
                  </li>
                </ul>
                <div className="text-sm font-medium text-gray-900">
                  {t('typeSelection.personal.cost', { credits: PRICING_CONFIG.credits.perGeneration })}
                </div>
                <div className="text-xs text-gray-500">
                  {t('typeSelection.personal.remaining', { credits: userCredits.individual })}
                </div>
              </div>
            </div>
            {!canUsePersonal && (
              <div className="mt-2 text-sm text-red-600">
                {t('typeSelection.personal.insufficientCredits')}
              </div>
            )}
          </div>

          {/* Team Use Option */}
          <div
            className={`relative border-2 rounded-lg p-6 cursor-pointer transition-all ${
              selectedType === 'team'
                ? 'border-brand-primary bg-brand-primary-light'
                : 'border-gray-200 hover:border-gray-300'
            } ${!canUseTeam ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => canUseTeam && setSelectedType('team')}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="generationType"
                checked={selectedType === 'team'}
                onChange={() => setSelectedType('team')}
                disabled={!canUseTeam}
                className="mt-1"
              />
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {t('typeSelection.team.title')}
                </h3>
                <ul className="text-sm text-gray-600 space-y-1 mb-4">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {t('typeSelection.team.presetStyles')}
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {t('typeSelection.team.branded')}
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {t('typeSelection.team.adminVisible')}
                  </li>
                </ul>
                <div className="text-sm font-medium text-gray-900">
                  {t('typeSelection.team.cost', { credits: PRICING_CONFIG.credits.perGeneration })}
                </div>
                <div className="text-xs text-gray-500">
                  {t('typeSelection.team.remaining', { credits: userCredits.team })}
                  {teamName && ` • ${teamName}`}
                </div>
              </div>
            </div>
            {!canUseTeam && (
              <div className="mt-2 text-sm text-red-600">
                {hasTeamAccess 
                  ? t('typeSelection.team.insufficientCredits')
                  : t('typeSelection.team.noAccess')
                }
              </div>
            )}
          </div>
        </Grid>

        {/* Continue Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleContinue}
            disabled={!selectedType}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedType
                ? 'bg-brand-primary text-white hover:bg-brand-primary-hover'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
          >
            {t('typeSelection.continue')}
          </button>
        </div>

        {/* Help Text */}
        <div className="mt-4 text-xs text-gray-500">
          {t('typeSelection.helpText')}
        </div>
      </div>
    </div>
  )
}
