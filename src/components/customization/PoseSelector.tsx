'use client'

import { useTranslations } from 'next-intl'
import { PoseSettings } from '@/types/photo-style'

interface PoseSelectorProps {
  value: PoseSettings
  onChange: (settings: PoseSettings) => void
  isPredefined?: boolean
  isDisabled?: boolean
  className?: string
  showHeader?: boolean
}

const POSES = [
  {
    value: 'power_classic',
    label: 'Power Pose - Classic',
    description: 'Executive, founder, leadership',
    icon: '💪',
    color: 'from-blue-600 to-indigo-600',
    category: 'power'
  },
  {
    value: 'power_crossed',
    label: 'Power Pose - Arms Crossed',
    description: 'Professional, expert, corporate',
    icon: '🤝',
    color: 'from-purple-600 to-blue-600',
    category: 'power'
  },
  {
    value: 'casual_confident',
    label: 'Casual Confident',
    description: 'Modern professional, tech, creative',
    icon: '😎',
    color: 'from-green-500 to-emerald-500',
    category: 'approachable'
  },
  {
    value: 'approachable_cross',
    label: 'Approachable Expert',
    description: 'Consultant, coach, service',
    icon: '🤗',
    color: 'from-teal-500 to-cyan-500',
    category: 'approachable'
  },
  {
    value: 'walking_confident',
    label: 'Walking - Purposeful',
    description: 'Dynamic, modern, leadership',
    icon: '🚶',
    color: 'from-orange-500 to-red-500',
    category: 'dynamic'
  },
  {
    value: 'sitting_engaged',
    label: 'Sitting Forward - Engaged',
    description: 'Coach, consultant, empathetic',
    icon: '🪑',
    color: 'from-amber-500 to-yellow-500',
    category: 'seated'
  },
  {
    value: 'executive_seated',
    label: 'Seated Executive',
    description: 'Executive, c-suite, formal',
    icon: '👔',
    color: 'from-gray-700 to-gray-900',
    category: 'seated'
  },
  {
    value: 'thinker',
    label: 'The Thinker',
    description: 'Thought leader, expert, strategic',
    icon: '🤔',
    color: 'from-violet-500 to-purple-600',
    category: 'thoughtful'
  }
] as const

export default function PoseSelector({
  value,
  onChange,
  isPredefined = false,
  isDisabled = false,
  className = '',
  showHeader = false
}: PoseSelectorProps) {
  const t = useTranslations('customization.photoStyle.pose')

  const handleChange = (pose: PoseSettings['type'], event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    if (isPredefined) return
    onChange({ type: pose })
  }

  return (
    <div className={`${className}`}>
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {t('title', { default: 'Pose' })}
            </h3>
            <p className="hidden md:block text-sm text-gray-600">
              {t('subtitle', { default: 'Choose a body pose and positioning' })}
            </p>
          </div>
          {isPredefined && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {t('predefined', { default: 'Predefined' })}
            </span>
          )}
        </div>
      )}

      <div className={`space-y-4 ${isDisabled ? 'opacity-60 pointer-events-none' : ''}`}>
        {POSES.map((pose) => {
          const isSelected = value.type === pose.value
          // On mobile, hide unselected options when predefined
          const shouldHide = isPredefined && !isSelected
          
          return (
            <button
              type="button"
              key={pose.value}
              onClick={(e) =>
                !(isPredefined || isDisabled) &&
                handleChange(pose.value as PoseSettings['type'], e)
              }
              disabled={isPredefined || isDisabled}
              className={`w-full bg-gray-50 rounded-lg p-4 border-2 transition-all ${
                isSelected
                  ? 'border-brand-primary bg-brand-primary-light shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-white hover:shadow-sm'
              } ${(isPredefined || isDisabled) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${
                shouldHide ? 'hidden md:block' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-2xl ${
                  isSelected 
                    ? `bg-gradient-to-br ${pose.color}` 
                    : 'bg-gray-200'
                }`}>
                  {pose.icon}
                </div>
                <div className="flex-1 text-left">
                  <div className={`text-sm font-semibold ${isSelected ? 'text-brand-primary' : 'text-gray-900'}`}>
                    {t(`poses.${pose.value}.label`, { default: pose.label })}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {t(`poses.${pose.value}.description`, { default: pose.description })}
                  </div>
                </div>
                {isSelected && (
                  <div className="w-5 h-5 bg-brand-primary rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

