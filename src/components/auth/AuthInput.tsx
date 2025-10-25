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
    const label = ['Weak', 'Fair', 'Good', 'Strong'][level]
    return { level, label }
  }, [props.value, strengthMeter])

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <div className="mt-1 relative">
        <input
          id={id}
          type={isPassword && show ? 'text' : type}
          className={`block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary sm:text-sm text-gray-900 ${className}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute inset-y-0 right-3 my-auto text-sm text-gray-600 hover:text-gray-900"
            aria-label={show ? 'Hide password' : 'Show password'}
          >
            {show ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {strengthMeter && (
        <div className="mt-2">
          <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-1.5 rounded-full ${
                strength.level === 0 ? 'w-1/4 bg-red-500' : strength.level === 1 ? 'w-1/2 bg-yellow-500' : strength.level === 2 ? 'w-3/4 bg-green-500' : 'w-full bg-green-600'
              }`}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">{strength.label}</p>
        </div>
      )}
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}


