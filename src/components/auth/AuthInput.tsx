'use client'

import React, { useMemo, useState } from 'react'

type AuthInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  hint?: string
  strengthMeter?: boolean
}

export default function AuthInput({ label, hint, id, className = '', strengthMeter = false, type, ...props }: AuthInputProps) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'

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
    const label = ['👶 Weak', '🫤 Fair', '💪 Good', '🦾 Strong'][level]
    return { level, label }
  }, [props.value, strengthMeter])

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-sm font-semibold text-text-dark mb-2">
          {label}
        </label>
      )}
      <div className="mt-1 relative">
        <input
          id={id}
          type={isPassword && show ? 'text' : type}
          className={`block w-full px-4 py-3.5 border-2 border-brand-primary-lighter rounded-xl shadow-depth-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary text-base text-text-dark bg-bg-white transition-all duration-300 hover:border-brand-primary ${className}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute inset-y-0 right-3 my-auto text-sm text-text-body hover:text-brand-primary transition-colors duration-300"
            aria-label={show ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {show ? '🙈 Hide' : '👁️ Show'}
          </button>
        )}
      </div>
      {strengthMeter && (
        <div className="mt-2">
          <div className="h-2 w-full bg-bg-gray-50 rounded-full overflow-hidden border border-brand-primary-lighter">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                strength.level === 0 ? 'w-1/4 bg-red-500' : strength.level === 1 ? 'w-1/2 bg-yellow-500' : strength.level === 2 ? 'w-3/4 bg-brand-secondary' : 'w-full bg-brand-secondary-hover'
              }`}
            />
          </div>
          <p className="mt-2 text-xs text-text-muted">{strength.label}</p>
        </div>
      )}
      {hint && <p className="mt-2 text-xs text-text-muted">{hint}</p>}
    </div>
  )
}


