'use client'

import React from 'react'

type AuthButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean
  children: React.ReactNode
}

export default function AuthButton({ isLoading, children, className = '', ...props }: AuthButtonProps) {
  return (
    <button
      {...props}
      className={`w-full flex justify-center items-center gap-2 py-3 px-4 rounded-lg text-white bg-brand-primary hover:bg-brand-primary-hover focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 disabled:opacity-50 shadow-md transition-colors ${className}`}
      disabled={props.disabled || isLoading}
   >
      {isLoading ? 'Please wait…' : children}
    </button>
  )
}


