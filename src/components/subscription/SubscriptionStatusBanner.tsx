"use client"

import { CheckIcon } from "@heroicons/react/24/outline"
import { ReactNode } from "react"

type Props = {
  title: string
  subtitle?: string
  statusLabel?: string
  statusColor?: 'green' | 'amber'
  rightNote?: string
  children?: ReactNode
}

export default function SubscriptionStatusBanner({ title, subtitle, statusLabel = "Active", statusColor = 'green', rightNote, children }: Props) {
  const colorClasses = statusColor === 'amber' 
    ? {
        bg: 'bg-gradient-to-r from-amber-50 to-yellow-50',
        border: 'border-amber-200',
        subtitle: 'text-amber-800/80',
        badge: 'bg-amber-100 text-amber-800',
      }
    : {
        bg: 'bg-gradient-to-r from-emerald-50 to-teal-50',
        border: 'border-emerald-200',
        subtitle: 'text-emerald-800/80',
        badge: 'bg-emerald-100 text-emerald-800',
      }

  return (
    <div className={`${colorClasses.bg} border ${colorClasses.border} rounded-xl p-6`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            {!rightNote && (
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${colorClasses.badge} shadow-sm`}>
                <CheckIcon className="h-4 w-4 mr-1" />
                {statusLabel}
              </span>
            )}
          </div>
          {subtitle && <p className={`text-sm ${colorClasses.subtitle}`}>{subtitle}</p>}
          {rightNote && <p className={`mt-1 text-xs ${colorClasses.subtitle}`}>{rightNote}</p>}
        </div>
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}


