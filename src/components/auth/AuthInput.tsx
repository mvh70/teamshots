'use client'

import React, { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'

type AuthInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: React.ReactNode
  hint?: string
  strengthMeter?: boolean
}

export default function AuthInput({ label, hint, id, className = '', strengthMeter = false, type, ...props }: AuthInputProps) {
  const t = useTranslations('auth.password')
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'

  const strengthLabels = [t('strength.weak'), t('strength.fair'), t('strength.good'), t('strength.strong')]

  const strength = useMemo(() => {
    if (!strengthMeter || typeof props.value !== 'string') return { level: 0, label: '' }
    const v = props.value
    let score = 0
    if (v.length >= 8) score++
    if (/[A-Z]/.test(v)) score++
    if (/[a-z]/.test(v)) score++
    if (/[0-9]/.test(v)) score++
    if (/[^A-Za-z0-9]/.test(v)) score++
    const level = Math.min(3, Math.floor(score / 2))
    return { level, label: strengthLabels[level] }
  }, [props.value, strengthMeter, strengthLabels])

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-sm font-semibold text-slate-700 mb-2.5 tracking-tight">
          {label}
        </label>
      )}
      <div className="mt-1.5 relative">
        <input
          id={id}
          type={isPassword && show ? 'text' : type}
          className={`block w-full px-5 py-4 border-2 border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-base text-slate-900 bg-white transition-all duration-300 hover:border-slate-300 hover:shadow-md focus:shadow-lg focus:scale-[1.01] ${className}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute inset-y-0 right-4 my-auto text-sm text-slate-500 hover:text-blue-600 font-medium transition-colors duration-200"
            aria-label={show ? t('hide') : t('show')}
            tabIndex={-1}
          >
            {show ? t('hide') : t('show')}
          </button>
        )}
      </div>
      {strengthMeter && (
        <div className="mt-3">
          <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-300 ${
                strength.level === 0 ? 'w-1/4 bg-red-400' : strength.level === 1 ? 'w-1/2 bg-yellow-400' : strength.level === 2 ? 'w-3/4 bg-blue-500' : 'w-full bg-green-500'
              }`}
            />
          </div>
          <p className="mt-2 text-xs font-medium text-slate-600">{strength.label}</p>
        </div>
      )}
      {hint && <p className="mt-2.5 text-xs text-slate-500 leading-relaxed">{hint}</p>}
    </div>
  )
}


