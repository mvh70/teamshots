'use client'

import React from 'react'
import { ChevronLeftIcon, ChevronRightIcon, PlayIcon } from '@heroicons/react/24/outline'
import { SmallLoadingSpinner } from '@/components/ui/LoadingSpinner'
import { MOBILE_STICKY_FOOTER_SURFACE } from './mobileFooterStyles'

type FooterActionTone = 'secondary' | 'primary' | 'gradient'
type FooterActionIcon = 'chevron-right' | 'play' | 'none'

interface FooterAction {
  label: string
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  hidden?: boolean
  tone?: FooterActionTone
  icon?: FooterActionIcon
  testId?: string
}

interface FooterCenterAction {
  label: string
  onClick: () => void
  disabled?: boolean
  testId?: string
}

interface CustomizationMobileFooterProps {
  leftAction: FooterAction
  centerAction?: FooterCenterAction
  rightAction?: FooterAction
  progressContent: React.ReactNode
  children?: React.ReactNode
  className?: string
}

function getRightActionClasses(tone: FooterActionTone, disabled: boolean): string {
  if (disabled) {
    return 'bg-gray-200 text-gray-400 cursor-not-allowed'
  }

  if (tone === 'gradient') {
    return 'bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition'
  }

  if (tone === 'primary') {
    return 'bg-brand-primary text-white hover:brightness-110 transition'
  }

  return 'border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100 transition-colors'
}

function RightActionIcon({ icon }: { icon: FooterActionIcon }) {
  if (icon === 'none') return null
  if (icon === 'play') {
    return (
      <PlayIcon className="w-4 h-4" />
    )
  }

  return (
    <ChevronRightIcon className="w-4 h-4" />
  )
}

export default function CustomizationMobileFooter({
  leftAction,
  centerAction,
  rightAction,
  progressContent,
  children,
  className = ''
}: CustomizationMobileFooterProps) {
  const visibleRightAction = rightAction && !rightAction.hidden ? rightAction : null
  const rightTone = visibleRightAction?.tone ?? 'primary'
  const rightIcon = visibleRightAction?.icon ?? 'chevron-right'
  const isRightLoading = Boolean(visibleRightAction?.loading)
  const isRightDisabled = isRightLoading || Boolean(visibleRightAction?.disabled)
  const showRightAction = visibleRightAction !== null

  return (
    <div
      className={`md:hidden fixed bottom-0 left-0 right-0 z-50 ${MOBILE_STICKY_FOOTER_SURFACE} pt-3 px-4 ${className}`}
      style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="grid grid-cols-[auto,1fr,auto] items-center gap-2 pb-3">
        <button
          type="button"
          onClick={leftAction.onClick}
          disabled={Boolean(leftAction.disabled)}
          data-testid={leftAction.testId ?? 'mobile-footer-left-action'}
          className="flex items-center gap-2 pr-4 pl-3 h-11 rounded-full border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          <span className="text-sm font-medium">{leftAction.label}</span>
        </button>

        <div className="flex justify-center">
          {centerAction ? (
            <button
              type="button"
              onClick={centerAction.onClick}
              disabled={Boolean(centerAction.disabled)}
              data-testid={centerAction.testId ?? 'mobile-footer-center-action'}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors min-h-[44px] px-2 disabled:opacity-50"
            >
              {centerAction.label}
            </button>
          ) : null}
        </div>

        {showRightAction ? (
          <button
            type="button"
            onClick={visibleRightAction.onClick}
            disabled={isRightDisabled}
            aria-busy={isRightLoading || undefined}
            data-testid={visibleRightAction.testId ?? 'mobile-footer-right-action'}
            className={`flex items-center gap-2 pl-4 pr-3 h-11 rounded-full ${getRightActionClasses(rightTone, isRightDisabled)}`}
          >
            <span className="text-sm font-medium">{visibleRightAction.label}</span>
            {isRightLoading ? (
              <SmallLoadingSpinner className="border-white/30 border-t-white text-white" />
            ) : (
              <RightActionIcon icon={rightIcon} />
            )}
          </button>
        ) : (
          <div className="h-11" />
        )}
      </div>

      {progressContent}
      {children}
    </div>
  )
}
