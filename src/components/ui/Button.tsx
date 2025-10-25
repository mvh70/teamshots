import React from 'react'

interface ButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  'data-testid'?: string
}

export function Button({ 
  children, 
  onClick, 
  variant = 'primary', 
  size = 'sm', 
  className = '', 
  disabled = false,
  type = 'button',
  'data-testid': testId
}: ButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors'
  
  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg'
  }
  
  const variantClasses = {
    primary: 'bg-brand-primary text-white hover:bg-brand-primary-hover focus:ring-brand-primary disabled:opacity-50 disabled:cursor-not-allowed',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed'
  }
  
  const classes = `${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`
  
  return (
    <button 
      className={classes}
      onClick={onClick}
      disabled={disabled}
      type={type}
      data-testid={testId}
    >
      {children}
    </button>
  )
}

// Specialized button variants for common use cases
export function PrimaryButton({ children, ...props }: Omit<ButtonProps, 'variant'>) {
  return <Button variant="primary" {...props}>{children}</Button>
}

export function SecondaryButton({ children, ...props }: Omit<ButtonProps, 'variant'>) {
  return <Button variant="secondary" {...props}>{children}</Button>
}

export function DangerButton({ children, ...props }: Omit<ButtonProps, 'variant'>) {
  return <Button variant="danger" {...props}>{children}</Button>
}
